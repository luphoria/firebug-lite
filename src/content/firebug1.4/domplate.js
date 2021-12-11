// Problems in IE
// FIXED - eval return
// FIXED - addEventListener problem in IE
// FIXED doc.createRange?
//
// class reserved word
// test all honza examples in IE6 and IE7


/* See license.txt for terms of usage */

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

function DomplateTag(tagName)
{
    this.tagName = tagName;
}

function DomplateEmbed()
{
}

function DomplateLoop()
{
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

( /** @scope ns-domplate */ function() {

let womb = null;

let domplate = FBL.domplate = function()
{
    let lastSubject;
    for (let i = 0; i < arguments.length; ++i)
        lastSubject = lastSubject ? copyObject(lastSubject, arguments[i]) : arguments[i];

    for (let name in lastSubject)
    {
        let val = lastSubject[name];
        if (isTag(val))
            val.tag.subject = lastSubject;
    }

    return lastSubject;
};

domplate.context = function(context, fn)
{
    let lastContext = domplate.lastContext;
    domplate.topContext = context;
    fn.apply(context);
    domplate.topContext = lastContext;
};

FBL.TAG = function()
{
    let embed = new DomplateEmbed();
    return embed.merge(arguments);
};

FBL.FOR = function()
{
    let loop = new DomplateLoop();
    return loop.merge(arguments);
};

DomplateTag.prototype =
{
    merge: function(args, oldTag)
    {
        if (oldTag)
            this.tagName = oldTag.tagName;

        this.context = oldTag ? oldTag.context : null;
        this.subject = oldTag ? oldTag.subject : null;
        this.attrs = oldTag ? copyObject(oldTag.attrs) : {};
        this.classes = oldTag ? copyObject(oldTag.classes) : {};
        this.props = oldTag ? copyObject(oldTag.props) : null;
        this.listeners = oldTag ? copyArray(oldTag.listeners) : null;
        this.children = oldTag ? copyArray(oldTag.children) : [];
        this.lets = oldTag ? copyArray(oldTag.lets) : [];

        let attrs = args.length ? args[0] : null;
        let hasAttrs = typeof(attrs) == "object" && !isTag(attrs);

        this.children = [];

        if (domplate.topContext)
            this.context = domplate.topContext;

        if (args.length)
            parseChildren(args, hasAttrs ? 1 : 0, this.lets, this.children);

        if (hasAttrs)
            this.parseAttrs(attrs);

        return creator(this, DomplateTag);
    },

    parseAttrs: function(args)
    {
        for (let name in args)
        {
            let val = parseValue(args[name]);
            readPartNames(val, this.lets);

            if (name.indexOf("on") == 0)
            {
                let eventName = name.substr(2);
                if (!this.listeners)
                    this.listeners = [];
                this.listeners.push(eventName, val);
            }
            else if (name.indexOf("_") == 0)
            {
                let propName = name.substr(1);
                if (!this.props)
                    this.props = {};
                this.props[propName] = val;
            }
            else if (name.indexOf("$") == 0)
            {
                let className = name.substr(1);
                if (!this.classes)
                    this.classes = {};
                this.classes[className] = val;
            }
            else
            {
                if (name == "class" && this.attrs.hasOwnProperty(name) )
                    this.attrs[name] += " " + val;
                else
                    this.attrs[name] = val;
            }
        }
    },

    compile: function()
    {
        if (this.renderMarkup)
            return;

        this.compileMarkup();
        this.compileDOM();

        //if (FBTrace.DBG_DOM) FBTrace.sysout("domplate renderMarkup: ", this.renderMarkup);
        //if (FBTrace.DBG_DOM) FBTrace.sysout("domplate renderDOM:", this.renderDOM);
        //if (FBTrace.DBG_DOM) FBTrace.sysout("domplate domArgs:", this.domArgs);
    },

    compileMarkup: function()
    {
        this.markupArgs = [];
        let topBlock = [], topOuts = [], blocks = [], info = {args: this.markupArgs, argIndex: 0};
         
        this.generateMarkup(topBlock, topOuts, blocks, info);
        this.addCode(topBlock, topOuts, blocks);

        let fnBlock = ['r=(function (__code__, __context__, __in__, __out__'];
        for (let i = 0; i < info.argIndex; ++i)
            fnBlock.push(', s', i);
        fnBlock.push(') {');

        if (this.subject)
            fnBlock.push('with (this) {');
        if (this.context)
            fnBlock.push('with (__context__) {');
        fnBlock.push('with (__in__) {');

        fnBlock.push.apply(fnBlock, blocks);

        if (this.subject)
            fnBlock.push('}');
        if (this.context)
            fnBlock.push('}');

        fnBlock.push('}})');

        function __link__(tag, code, outputs, args)
        {
            if (!tag || !tag.tag)
                return;

            tag.tag.compile();

            let tagOutputs = [];
            let markupArgs = [code, tag.tag.context, args, tagOutputs];
            markupArgs.push.apply(markupArgs, tag.tag.markupArgs);
            tag.tag.renderMarkup.apply(tag.tag.subject, markupArgs);

            outputs.push(tag);
            outputs.push(tagOutputs);
        }

        function __escape__(value)
        {
            function replaceChars(ch)
            {
                switch (ch)
                {
                    case "<":
                        return "&lt;";
                    case ">":
                        return "&gt;";
                    case "&":
                        return "&amp;";
                    case "'":
                        return "&#39;";
                    case '"':
                        return "&quot;";
                }
                return "?";
            };
            return String(value).replace(/[<>&"']/g, replaceChars);
        }

        function __loop__(iter, outputs, fn)
        {
            let iterOuts = [];
            outputs.push(iterOuts);

            if (iter instanceof Array)
                iter = new ArrayIterator(iter);

            try
            {
                while (1)
                {
                    let value = iter.next();
                    let itemOuts = [0,0];
                    iterOuts.push(itemOuts);
                    fn.apply(this, [value, itemOuts]);
                }
            }
            catch (exc)
            {
                if (exc != StopIteration)
                    throw exc;
            }
        }

        let js = fnBlock.join("");
        let r = null;
        eval(js);
        this.renderMarkup = r;
    },

    getletNames: function(args)
    {
        if (this.lets)
            args.push.apply(args, this.lets);

        for (let i = 0; i < this.children.length; ++i)
        {
            let child = this.children[i];
            if (isTag(child))
                child.tag.getletNames(args);
            else if (child instanceof Parts)
            {
                for (let i = 0; i < child.parts.length; ++i)
                {
                    if (child.parts[i] instanceof letiable)
                    {
                        let name = child.parts[i].name;
                        let names = name.split(".");
                        args.push(names[0]);
                    }
                }
            }
        }
    },

    generateMarkup: function(topBlock, topOuts, blocks, info)
    {
        topBlock.push(',"<', this.tagName, '"');

        for (let name in this.attrs)
        {
            if (name != "class")
            {
                let val = this.attrs[name];
                topBlock.push(', " ', name, '=\\""');
                addParts(val, ',', topBlock, info, true);
                topBlock.push(', "\\""');
            }
        }

        if (this.listeners)
        {
            for (let i = 0; i < this.listeners.length; i += 2)
                readPartNames(this.listeners[i+1], topOuts);
        }

        if (this.props)
        {
            for (let name in this.props)
                readPartNames(this.props[name], topOuts);
        }

        if ( this.attrs.hasOwnProperty("class") || this.classes)
        {
            topBlock.push(', " class=\\""');
            if (this.attrs.hasOwnProperty("class"))
                addParts(this.attrs["class"], ',', topBlock, info, true);
              topBlock.push(', " "');
            for (let name in this.classes)
            {
                topBlock.push(', (');
                addParts(this.classes[name], '', topBlock, info);
                topBlock.push(' ? "', name, '" + " " : "")');
            }
            topBlock.push(', "\\""');
        }
        topBlock.push(',">"');

        this.generateChildMarkup(topBlock, topOuts, blocks, info);
        topBlock.push(',"</', this.tagName, '>"');
    },

    generateChildMarkup: function(topBlock, topOuts, blocks, info)
    {
        for (let i = 0; i < this.children.length; ++i)
        {
            let child = this.children[i];
            if (isTag(child))
                child.tag.generateMarkup(topBlock, topOuts, blocks, info);
            else
                addParts(child, ',', topBlock, info, true);
        }
    },

    addCode: function(topBlock, topOuts, blocks)
    {
        if (topBlock.length)
            blocks.push('__code__.push(""', topBlock.join(""), ');');
        if (topOuts.length)
            blocks.push('__out__.push(', topOuts.join(","), ');');
        topBlock.splice(0, topBlock.length);
        topOuts.splice(0, topOuts.length);
    },

    addLocals: function(blocks)
    {
        let letNames = [];
        this.getletNames(letNames);

        let map = {};
        for (let i = 0; i < letNames.length; ++i)
        {
            let name = letNames[i];
            if ( map.hasOwnProperty(name) )
                continue;

            map[name] = 1;
            let names = name.split(".");
            blocks.push('let ', names[0] + ' = ' + '__in__.' + names[0] + ';');
        }
    },

    compileDOM: function()
    {
        let path = [];
        let blocks = [];
        this.domArgs = [];
        path.embedIndex = 0;
        path.loopIndex = 0;
        path.staticIndex = 0;
        path.renderIndex = 0;
        let nodeCount = this.generateDOM(path, blocks, this.domArgs);

        let fnBlock = ['r=(function (root, context, o'];

        for (let i = 0; i < path.staticIndex; ++i)
            fnBlock.push(', ', 's'+i);

        for (let i = 0; i < path.renderIndex; ++i)
            fnBlock.push(', ', 'd'+i);

        fnBlock.push(') {');
        for (let i = 0; i < path.loopIndex; ++i)
            fnBlock.push('let l', i, ' = 0;');
        for (let i = 0; i < path.embedIndex; ++i)
            fnBlock.push('let e', i, ' = 0;');

        if (this.subject)
            fnBlock.push('with (this) {');
        if (this.context)
            fnBlock.push('with (context) {');

        fnBlock.push(blocks.join(""));

        if (this.subject)
            fnBlock.push('}');
        if (this.context)
            fnBlock.push('}');

        fnBlock.push('return ', nodeCount, ';');
        fnBlock.push('})');

        function __bind__(object, fn)
        {
            return function(event) { return fn.apply(object, [event]); };
        }

        function __link__(node, tag, args)
        {
            if (!tag || !tag.tag)
                return;

            tag.tag.compile();

            let domArgs = [node, tag.tag.context, 0];
            domArgs.push.apply(domArgs, tag.tag.domArgs);
            domArgs.push.apply(domArgs, args);
            //if (FBTrace.DBG_DOM) FBTrace.dumpProperties("domplate__link__ domArgs:", domArgs);
            return tag.tag.renderDOM.apply(tag.tag.subject, domArgs);
        }

        let self = this;
        function __loop__(iter, fn)
        {
            let nodeCount = 0;
            for (let i = 0; i < iter.length; ++i)
            {
                iter[i][0] = i;
                iter[i][1] = nodeCount;
                nodeCount += fn.apply(this, iter[i]);
                //if (FBTrace.DBG_DOM) FBTrace.sysout("nodeCount", nodeCount);
            }
            return nodeCount;
        }

        function __path__(parent, offset)
        {
            //if (FBTrace.DBG_DOM) FBTrace.sysout("domplate __path__ offset: "+ offset+"\n");
            let root = parent;

            for (let i = 2; i < arguments.length; ++i)
            {
                let index = arguments[i];
                if (i == 3)
                    index += offset;

                if (index == -1)
                    parent = parent.parentNode;
                else
                    parent = parent.childNodes[index];
            }

            //if (FBTrace.DBG_DOM) FBTrace.sysout("domplate: "+arguments[2]+", root: "+ root+", parent: "+ parent+"\n");
            return parent;
        }

        let js = fnBlock.join("");
        //if (FBTrace.DBG_DOM) FBTrace.sysout(js.replace(/(\;|\{)/g, "$1\n"));
        let r = null;
        eval(js);
        this.renderDOM = r;
    },

    generateDOM: function(path, blocks, args)
    {
        if (this.listeners || this.props)
            this.generateNodePath(path, blocks);

        if (this.listeners)
        {
            for (let i = 0; i < this.listeners.length; i += 2)
            {
                let val = this.listeners[i+1];
                let arg = generateArg(val, path, args);
                //blocks.push('node.addEventListener("', this.listeners[i], '", __bind__(this, ', arg, '), false);');
                blocks.push('addEvent(node, "', this.listeners[i], '", __bind__(this, ', arg, '), false);');
            }
        }

        if (this.props)
        {
            for (let name in this.props)
            {
                let val = this.props[name];
                let arg = generateArg(val, path, args);
                blocks.push('node.', name, ' = ', arg, ';');
            }
        }

        this.generateChildDOM(path, blocks, args);
        return 1;
    },

    generateNodePath: function(path, blocks)
    {
        blocks.push("node = __path__(root, o");
        for (let i = 0; i < path.length; ++i)
            blocks.push(",", path[i]);
        blocks.push(");");
    },

    generateChildDOM: function(path, blocks, args)
    {
        path.push(0);
        for (let i = 0; i < this.children.length; ++i)
        {
            let child = this.children[i];
            if (isTag(child))
                path[path.length-1] += '+' + child.tag.generateDOM(path, blocks, args);
            else
                path[path.length-1] += '+1';
        }
        path.pop();
    }
};

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

DomplateEmbed.prototype = copyObject(DomplateTag.prototype,
{
    merge: function(args, oldTag)
    {
        this.value = oldTag ? oldTag.value : parseValue(args[0]);
        this.attrs = oldTag ? oldTag.attrs : {};
        this.lets = oldTag ? copyArray(oldTag.lets) : [];

        let attrs = args[1];
        for (let name in attrs)
        {
            let val = parseValue(attrs[name]);
            this.attrs[name] = val;
            readPartNames(val, this.lets);
        }

        return creator(this, DomplateEmbed);
    },

    getletNames: function(names)
    {
        if (this.value instanceof Parts)
            names.push(this.value.parts[0].name);

        if (this.lets)
            names.push.apply(names, this.lets);
    },

    generateMarkup: function(topBlock, topOuts, blocks, info)
    {
        this.addCode(topBlock, topOuts, blocks);

        blocks.push('__link__(');
        addParts(this.value, '', blocks, info);
        blocks.push(', __code__, __out__, {');

        let lastName = null;
        for (let name in this.attrs)
        {
            if (lastName)
                blocks.push(',');
            lastName = name;

            let val = this.attrs[name];
            blocks.push('"', name, '":');
            addParts(val, '', blocks, info);
        }

        blocks.push('});');
        //this.generateChildMarkup(topBlock, topOuts, blocks, info);
    },

    generateDOM: function(path, blocks, args)
    {
        let embedName = 'e'+path.embedIndex++;

        this.generateNodePath(path, blocks);

        let valueName = 'd' + path.renderIndex++;
        let argsName = 'd' + path.renderIndex++;
        blocks.push(embedName + ' = __link__(node, ', valueName, ', ', argsName, ');');

        return embedName;
    }
});

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

DomplateLoop.prototype = copyObject(DomplateTag.prototype,
{
    merge: function(args, oldTag)
    {
        this.letName = oldTag ? oldTag.letName : args[0];
        this.iter = oldTag ? oldTag.iter : parseValue(args[1]);
        this.lets = [];

        this.children = oldTag ? copyArray(oldTag.children) : [];

        let offset = Math.min(args.length, 2);
        parseChildren(args, offset, this.lets, this.children);

        return creator(this, DomplateLoop);
    },

    getletNames: function(names)
    {
        if (this.iter instanceof Parts)
            names.push(this.iter.parts[0].name);

        DomplateTag.prototype.getletNames.apply(this, [names]);
    },

    generateMarkup: function(topBlock, topOuts, blocks, info)
    {
        this.addCode(topBlock, topOuts, blocks);

        let iterName;
        if (this.iter instanceof Parts)
        {
            let part = this.iter.parts[0];
            iterName = part.name;

            if (part.format)
            {
                for (let i = 0; i < part.format.length; ++i)
                    iterName = part.format[i] + "(" + iterName + ")";
            }
        }
        else
            iterName = this.iter;

        blocks.push('__loop__.apply(this, [', iterName, ', __out__, function(', this.letName, ', __out__) {');
        this.generateChildMarkup(topBlock, topOuts, blocks, info);
        this.addCode(topBlock, topOuts, blocks);
        blocks.push('}]);');
    },

    generateDOM: function(path, blocks, args)
    {
        let iterName = 'd'+path.renderIndex++;
        let counterName = 'i'+path.loopIndex;
        let loopName = 'l'+path.loopIndex++;

        if (!path.length)
            path.push(-1, 0);

        let preIndex = path.renderIndex;
        path.renderIndex = 0;

        let nodeCount = 0;

        let subBlocks = [];
        let basePath = path[path.length-1];
        for (let i = 0; i < this.children.length; ++i)
        {
            path[path.length-1] = basePath+'+'+loopName+'+'+nodeCount;

            let child = this.children[i];
            if (isTag(child))
                nodeCount += '+' + child.tag.generateDOM(path, subBlocks, args);
            else
                nodeCount += '+1';
        }

        path[path.length-1] = basePath+'+'+loopName;

        blocks.push(loopName,' = __loop__.apply(this, [', iterName, ', function(', counterName,',',loopName);
        for (let i = 0; i < path.renderIndex; ++i)
            blocks.push(',d'+i);
        blocks.push(') {');
        blocks.push(subBlocks.join(""));
        blocks.push('return ', nodeCount, ';');
        blocks.push('}]);');

        path.renderIndex = preIndex;

        return loopName;
    }
});

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

function letiable(name, format)
{
    this.name = name;
    this.format = format;
}

function Parts(parts)
{
    this.parts = parts;
}

// ************************************************************************************************

function parseParts(str)
{
    let re = /\$([_A-Za-z][_A-Za-z0-9.|]*)/g;
    let index = 0;
    let parts = [];

    let m;
    while (m = re.exec(str))
    {
        let pre = str.substr(index, (re.lastIndex-m[0].length)-index);
        if (pre)
            parts.push(pre);

        let expr = m[1].split("|");
        parts.push(new letiable(expr[0], expr.slice(1)));
        index = re.lastIndex;
    }

    if (!index)
        return str;

    let post = str.substr(index);
    if (post)
        parts.push(post);

    return new Parts(parts);
}

function parseValue(val)
{
    return typeof(val) == 'string' ? parseParts(val) : val;
}

function parseChildren(args, offset, lets, children)
{
    for (let i = offset; i < args.length; ++i)
    {
        let val = parseValue(args[i]);
        children.push(val);
        readPartNames(val, lets);
    }
}

function readPartNames(val, lets)
{
    if (val instanceof Parts)
    {
        for (let i = 0; i < val.parts.length; ++i)
        {
            let part = val.parts[i];
            if (part instanceof letiable)
                lets.push(part.name);
        }
    }
}

function generateArg(val, path, args)
{
    if (val instanceof Parts)
    {
        let vals = [];
        for (let i = 0; i < val.parts.length; ++i)
        {
            let part = val.parts[i];
            if (part instanceof letiable)
            {
                let letName = 'd'+path.renderIndex++;
                if (part.format)
                {
                    for (let j = 0; j < part.format.length; ++j)
                        letName = part.format[j] + '(' + letName + ')';
                }

                vals.push(letName);
            }
            else
                vals.push('"'+part.replace(/"/g, '\\"')+'"');
        }

        return vals.join('+');
    }
    else
    {
        args.push(val);
        return 's' + path.staticIndex++;
    }
}

function addParts(val, delim, block, info, escapeIt)
{
    let vals = [];
    if (val instanceof Parts)
    {
        for (let i = 0; i < val.parts.length; ++i)
        {
            let part = val.parts[i];
            if (part instanceof letiable)
            {
                let partName = part.name;
                if (part.format)
                {
                    for (let j = 0; j < part.format.length; ++j)
                        partName = part.format[j] + "(" + partName + ")";
                }

                if (escapeIt)
                    vals.push("__escape__(" + partName + ")");
                else
                    vals.push(partName);
            }
            else
                vals.push('"'+ part + '"');
        }
    }
    else if (isTag(val))
    {
        info.args.push(val);
        vals.push('s'+info.argIndex++);
    }
    else
        vals.push('"'+ val + '"');

    let parts = vals.join(delim);
    if (parts)
        block.push(delim, parts);
}

function isTag(obj)
{
    return (typeof(obj) == "function" || obj instanceof Function) && !!obj.tag;
}

function creator(tag, cons)
{
    let fn = new Function(
        "let tag = arguments.callee.tag;" +
        "let cons = arguments.callee.cons;" +
        "let newTag = new cons();" +
        "return newTag.merge(arguments, tag);");

    fn.tag = tag;
    fn.cons = cons;
    extend(fn, Renderer);

    return fn;
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

function copyArray(oldArray)
{
    let ary = [];
    if (oldArray)
        for (let i = 0; i < oldArray.length; ++i)
            ary.push(oldArray[i]);
   return ary;
}

function copyObject(l, r)
{
    let m = {};
    extend(m, l);
    extend(m, r);
    return m;
}

function extend(l, r)
{
    for (let n in r)
        l[n] = r[n];
}

function addEvent(object, name, handler)
{
    if (document.all)
        object.attachEvent("on"+name, handler);
    else
        object.addEventListener(name, handler, false);
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

function ArrayIterator(array)
{
    let index = -1;

    this.next = function()
    {
        if (++index >= array.length)
            throw StopIteration;

        return array[index];
    };
}

function StopIteration() {}

FBL.$break = function()
{
    throw StopIteration;
};

// ************************************************************************************************

let Renderer =
{
    renderHTML: function(args, outputs, self)
    {
        let code = [];
        let markupArgs = [code, this.tag.context, args, outputs];
        markupArgs.push.apply(markupArgs, this.tag.markupArgs);
        this.tag.renderMarkup.apply(self ? self : this.tag.subject, markupArgs);
        return code.join("");
    },

    insertRows: function(args, before, self)
    {
        this.tag.compile();

        let outputs = [];
        let html = this.renderHTML(args, outputs, self);

        let doc = before.ownerDocument;
        let div = doc.createElement("div");
        div.innerHTML = "<table><tbody>"+html+"</tbody></table>";

        let tbody = div.firstChild.firstChild;
        let parent = before.tagName == "TR" ? before.parentNode : before;
        let after = before.tagName == "TR" ? before.nextSibling : null;

        let firstRow = tbody.firstChild, lastRow;
        while (tbody.firstChild)
        {
            lastRow = tbody.firstChild;
            if (after)
                parent.insertBefore(lastRow, after);
            else
                parent.appendChild(lastRow);
        }

        let offset = 0;
        if (before.tagName == "TR")
        {
            let node = firstRow.parentNode.firstChild;
            for (; node && node != firstRow; node = node.nextSibling)
                ++offset;
        }

        let domArgs = [firstRow, this.tag.context, offset];
        domArgs.push.apply(domArgs, this.tag.domArgs);
        domArgs.push.apply(domArgs, outputs);

        this.tag.renderDOM.apply(self ? self : this.tag.subject, domArgs);
        return [firstRow, lastRow];
    },

    insertBefore: function(args, before, self)
    {
        return this.insertNode(args, before.ownerDocument, before, false, self);
    },

    insertAfter: function(args, after, self)
    {
        return this.insertNode(args, after.ownerDocument, after, true, self);
    },

    insertNode: function(args, doc, element, isAfter, self)
    {
        if (!args)
            args = {};

        this.tag.compile();

        let outputs = [];
        let html = this.renderHTML(args, outputs, self);
        
        //if (FBTrace.DBG_DOM)
        //    FBTrace.sysout("domplate.insertNode html: "+html+"\n");

        doc = element.ownerDocument;
        if (!womb || womb.ownerDocument != doc)
            womb = doc.createElement("div");
        
        womb.innerHTML = html;
  
        let root = womb.firstChild;
        if (isAfter)
        {
            while (womb.firstChild)
                if (element.nextSibling)
                    element.parentNode.insertBefore(womb.firstChild, element.nextSibling);
                else
                    element.parentNode.appendChild(womb.firstChild);
        }
        else
        {
            while (womb.lastChild)
                element.parentNode.insertBefore(womb.lastChild, element);
        }

        let domArgs = [root, this.tag.context, 0];
        domArgs.push.apply(domArgs, this.tag.domArgs);
        domArgs.push.apply(domArgs, outputs);

        //if (FBTrace.DBG_DOM)
        //    FBTrace.sysout("domplate.insertNode domArgs:", domArgs);
        this.tag.renderDOM.apply(self ? self : this.tag.subject, domArgs);

        return root;
    },
    /**/

    /*
    insertAfter: function(args, before, self)
    {
        this.tag.compile();

        let outputs = [];
        let html = this.renderHTML(args, outputs, self);

        let doc = before.ownerDocument;
        if (!womb || womb.ownerDocument != doc)
            womb = doc.createElement("div");
        
        womb.innerHTML = html;
  
        let root = womb.firstChild;
        while (womb.firstChild)
            if (before.nextSibling)
                before.parentNode.insertBefore(womb.firstChild, before.nextSibling);
            else
                before.parentNode.appendChild(womb.firstChild);
        
        let domArgs = [root, this.tag.context, 0];
        domArgs.push.apply(domArgs, this.tag.domArgs);
        domArgs.push.apply(domArgs, outputs);

        this.tag.renderDOM.apply(self ? self : (this.tag.subject ? this.tag.subject : null),
            domArgs);

        return root;
    },
    /**/
    
    replace: function(args, parent, self)
    {
        this.tag.compile();

        let outputs = [];
        let html = this.renderHTML(args, outputs, self);

        let root;
        if (parent.nodeType == 1)
        {
            parent.innerHTML = html;
            root = parent.firstChild;
        }
        else
        {
            if (!parent || parent.nodeType != 9)
                parent = document;

            if (!womb || womb.ownerDocument != parent)
                womb = parent.createElement("div");
            womb.innerHTML = html;

            root = womb.firstChild;
            //womb.removeChild(root);
        }

        let domArgs = [root, this.tag.context, 0];
        domArgs.push.apply(domArgs, this.tag.domArgs);
        domArgs.push.apply(domArgs, outputs);
        this.tag.renderDOM.apply(self ? self : this.tag.subject, domArgs);

        return root;
    },

    append: function(args, parent, self)
    {
        this.tag.compile();

        let outputs = [];
        let html = this.renderHTML(args, outputs, self);
        //if (FBTrace.DBG_DOM) FBTrace.sysout("domplate.append html: "+html+"\n");
        
        if (!womb || womb.ownerDocument != parent.ownerDocument)
            womb = parent.ownerDocument.createElement("div");
        womb.innerHTML = html;

        // TODO: xxxpedro domplate port to Firebug
        let root = womb.firstChild;
        while (womb.firstChild)
            parent.appendChild(womb.firstChild);

        // clearing element reference to avoid reference error in IE8 when switching contexts
        womb = null;
        
        let domArgs = [root, this.tag.context, 0];
        domArgs.push.apply(domArgs, this.tag.domArgs);
        domArgs.push.apply(domArgs, outputs);
        
        //if (FBTrace.DBG_DOM) FBTrace.dumpProperties("domplate append domArgs:", domArgs);
        this.tag.renderDOM.apply(self ? self : this.tag.subject, domArgs);

        return root;
    }
};

// ************************************************************************************************

function defineTags()
{
    for (let i = 0; i < arguments.length; ++i)
    {
        let tagName = arguments[i];
        let fn = new Function("let newTag = new arguments.callee.DomplateTag('"+tagName+"'); return newTag.merge(arguments);");
        fn.DomplateTag = DomplateTag;

        let fnName = tagName.toUpperCase();
        FBL[fnName] = fn;
    }
}

defineTags(
    "a", "button", "br", "canvas", "code", "col", "colgroup", "div", "fieldset", "form", "h1", "h2", "h3", "hr",
     "img", "input", "label", "legend", "li", "ol", "optgroup", "option", "p", "pre", "select",
    "span", "strong", "table", "tbody", "td", "textarea", "tfoot", "th", "thead", "tr", "tt", "ul", "iframe"
);

})();
