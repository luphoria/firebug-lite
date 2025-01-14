/* See license.txt for terms of usage */

let FirebugReps = FBL.ns(function() { with (FBL) {


// ************************************************************************************************
// Common Tags

let OBJECTBOX = this.OBJECTBOX =
    SPAN({"class": "objectBox objectBox-$className"});

let OBJECTBLOCK = this.OBJECTBLOCK =
    DIV({"class": "objectBox objectBox-$className"});

let OBJECTLINK = this.OBJECTLINK = isIE6 ? // IE6 object link representation
    A({
        "class": "objectLink objectLink-$className a11yFocus",
        href: "javascript:void(0)",
        _repObject: "$object"
    })
    : // Other browsers
    A({
        "class": "objectLink objectLink-$className a11yFocus",
        _repObject: "$object"
    });


// ************************************************************************************************

this.Undefined = domplate(Firebug.Rep,
{
    tag: OBJECTBOX("undefined"),

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    className: "undefined",

    supportsObject: function(object, type)
    {
        return type == "undefined";
    }
});

// ************************************************************************************************

this.Null = domplate(Firebug.Rep,
{
    tag: OBJECTBOX("null"),

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    className: "null",

    supportsObject: function(object, type)
    {
        return object == null;
    }
});

// ************************************************************************************************

this.Nada = domplate(Firebug.Rep,
{
    tag: SPAN(""),

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    className: "nada"
});

// ************************************************************************************************

this.Number = domplate(Firebug.Rep,
{
    tag: OBJECTBOX("$object"),

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    className: "number",

    supportsObject: function(object, type)
    {
        return type == "boolean" || type == "number";
    }
});

// ************************************************************************************************

this.String = domplate(Firebug.Rep,
{
    tag: OBJECTBOX("&quot;$object&quot;"),

    shortTag: OBJECTBOX("&quot;$object|cropString&quot;"),

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    className: "string",

    supportsObject: function(object, type)
    {
        return type == "string";
    }
});

// ************************************************************************************************

this.Text = domplate(Firebug.Rep,
{
    tag: OBJECTBOX("$object"),

    shortTag: OBJECTBOX("$object|cropString"),

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    className: "text"
});

// ************************************************************************************************

this.Caption = domplate(Firebug.Rep,
{
    tag: SPAN({"class": "caption"}, "$object")
});

// ************************************************************************************************

this.Warning = domplate(Firebug.Rep,
{
    tag: DIV({"class": "warning focusRow", role : 'listitem'}, "$object|STR")
});

// ************************************************************************************************

this.Func = domplate(Firebug.Rep,
{
    tag:
        OBJECTLINK("$object|summarizeFunction"),

    summarizeFunction: function(fn)
    {
        let fnRegex = /function ([^(]+\([^)]*\)) \{/;
        let fnText = safeToString(fn);

        let m = fnRegex.exec(fnText);
        return m ? m[1] : "function()";
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    copySource: function(fn)
    {
        copyToClipboard(safeToString(fn));
    },

    monitor: function(fn, script, monitored)
    {
        if (monitored)
            Firebug.Debugger.unmonitorScript(fn, script, "monitor");
        else
            Firebug.Debugger.monitorScript(fn, script, "monitor");
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    className: "function",

    supportsObject: function(object, type)
    {
        return isFunction(object);
    },

    inspectObject: function(fn, context)
    {
        let sourceLink = findSourceForFunction(fn, context);
        if (sourceLink)
            Firebug.chrome.select(sourceLink);
        if (FBTrace.DBG_FUNCTION_NAME)
            FBTrace.sysout("reps.function.inspectObject selected sourceLink is ", sourceLink);
    },

    getTooltip: function(fn, context)
    {
        let script = findScriptForFunctionInContext(context, fn);
        if (script)
            return $STRF("Line", [normalizeURL(script.fileName), script.baseLineNumber]);
        else
            if (fn.toString)
                return fn.toString();
    },

    getTitle: function(fn, context)
    {
        let name = fn.name ? fn.name : "function";
        return name + "()";
    },

    getContextMenuItems: function(fn, target, context, script)
    {
        if (!script)
            script = findScriptForFunctionInContext(context, fn);
        if (!script)
            return;

        let scriptInfo = getSourceFileAndLineByScript(context, script);
        let monitored = scriptInfo ? fbs.isMonitored(scriptInfo.sourceFile.href, scriptInfo.lineNo) : false;

        let name = script ? getFunctionName(script, context) : fn.name;
        return [
            {label: "CopySource", command: bindFixed(this.copySource, this, fn) },
            "-",
            {label: $STRF("ShowCallsInConsole", [name]), nol10n: true,
             type: "checkbox", checked: monitored,
             command: bindFixed(this.monitor, this, fn, script, monitored) }
        ];
    }
});

// ************************************************************************************************
/*
this.jsdScript = domplate(Firebug.Rep,
{
    copySource: function(script)
    {
        let fn = script.functionObject.getWrappedValue();
        return FirebugReps.Func.copySource(fn);
    },

    monitor: function(fn, script, monitored)
    {
        fn = script.functionObject.getWrappedValue();
        return FirebugReps.Func.monitor(fn, script, monitored);
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    className: "jsdScript",
    inspectable: false,

    supportsObject: function(object, type)
    {
        return object instanceof jsdIScript;
    },

    inspectObject: function(script, context)
    {
        let sourceLink = getSourceLinkForScript(script, context);
        if (sourceLink)
            Firebug.chrome.select(sourceLink);
    },

    getRealObject: function(script, context)
    {
        return script;
    },

    getTooltip: function(script)
    {
        return $STRF("jsdIScript", [script.tag]);
    },

    getTitle: function(script, context)
    {
        let fn = script.functionObject.getWrappedValue();
        return FirebugReps.Func.getTitle(fn, context);
    },

    getContextMenuItems: function(script, target, context)
    {
        let fn = script.functionObject.getWrappedValue();

        let scriptInfo = getSourceFileAndLineByScript(context, script);
           let monitored = scriptInfo ? fbs.isMonitored(scriptInfo.sourceFile.href, scriptInfo.lineNo) : false;

        let name = getFunctionName(script, context);

        return [
            {label: "CopySource", command: bindFixed(this.copySource, this, script) },
            "-",
            {label: $STRF("ShowCallsInConsole", [name]), nol10n: true,
             type: "checkbox", checked: monitored,
             command: bindFixed(this.monitor, this, fn, script, monitored) }
        ];
    }
});
/**/
//************************************************************************************************

this.Obj = domplate(Firebug.Rep,
{
    tag:
        OBJECTLINK(
            SPAN({"class": "objectTitle"}, "$object|getTitle "),
            
            SPAN({"class": "objectProps"}, 
                SPAN({"class": "objectLeftBrace", role: "presentation"}, "{"),
                FOR("prop", "$object|propIterator",
                    SPAN({"class": "objectPropName", role: "presentation"}, "$prop.name"),
                    SPAN({"class": "objectEqual", role: "presentation"}, "$prop.equal"),
                    TAG("$prop.tag", {object: "$prop.object"}),
                    SPAN({"class": "objectComma", role: "presentation"}, "$prop.delim")
                ),
                SPAN({"class": "objectRightBrace"}, "}")
            )
        ),

    propNumberTag:
        SPAN({"class": "objectProp-number"}, "$object"),

    propStringTag:
        SPAN({"class": "objectProp-string"}, "&quot;$object&quot;"),

    propObjectTag:
        SPAN({"class": "objectProp-object"}, "$object"),

    propIterator: function (object)
    {
        ///Firebug.ObjectShortIteratorMax;
        let maxLength = 55; // default max length for long representation
        
        if (!object)
            return [];

        let props = [];
        let length = 0;
        
        let numProperties = 0;
        let numPropertiesShown = 0;
        let maxLengthReached = false;
        
        let lib = this;
        
        let propRepsMap = 
        {
            "boolean": this.propNumberTag,
            "number": this.propNumberTag,
            "string": this.propStringTag,
            "object": this.propObjectTag
        };

        try
        {
            let title = Firebug.Rep.getTitle(object);
            length += title.length;

            for (let name in object)
            {
                let value;
                try
                {
                    value = object[name];
                }
                catch (exc)
                {
                    continue;
                }
                
                let type = typeof(value);
                if (type == "boolean" || 
                    type == "number" || 
                    (type == "string" && value) || 
                    (type == "object" && value && value.toString))
                {
                    let tag = propRepsMap[type];
                    
                    let value = (type == "object") ?
                        Firebug.getRep(value).getTitle(value) :
                        value + "";
                        
                    length += name.length + value.length + 4;
                    
                    if (length <= maxLength)
                    {
                        props.push({
                            tag: tag, 
                            name: name, 
                            object: value, 
                            equal: "=", 
                            delim: ", "
                        });
                        
                        numPropertiesShown++;
                    }
                    else
                        maxLengthReached = true;

                }
                
                numProperties++;
                
                if (maxLengthReached && numProperties > numPropertiesShown)
                    break;
            }
            
            if (numProperties > numPropertiesShown)
            {
                props.push({
                    object: "...", //xxxHonza localization
                    tag: FirebugReps.Caption.tag,
                    name: "",
                    equal:"",
                    delim:""
                });
            }
            else if (props.length > 0)
            {
                props[props.length-1].delim = '';
            }
        }
        catch (exc)
        {
            // Sometimes we get exceptions when trying to read from certain objects, like
            // StorageList, but don't let that gum up the works
            // XXXjjb also History.previous fails because object is a web-page object which does not have
            // permission to read the history
        }
        return props;
    },
    
    fb_1_6_propIterator: function (object, max)
    {
        max = max || 3;
        if (!object)
            return [];

        let props = [];
        let len = 0, count = 0;

        try
        {
            for (let name in object)
            {
                let value;
                try
                {
                    value = object[name];
                }
                catch (exc)
                {
                    continue;
                }

                let t = typeof(value);
                if (t == "boolean" || t == "number" || (t == "string" && value)
                    || (t == "object" && value && value.toString))
                {
                    let rep = Firebug.getRep(value);
                    let tag = rep.shortTag || rep.tag;
                    if (t == "object")
                    {
                        value = rep.getTitle(value);
                        tag = rep.titleTag;
                    }
                    count++;
                    if (count <= max)
                        props.push({tag: tag, name: name, object: value, equal: "=", delim: ", "});
                    else
                        break;
                }
            }
            if (count > max)
            {
                props[Math.max(1,max-1)] = {
                    object: "more...", //xxxHonza localization
                    tag: FirebugReps.Caption.tag,
                    name: "",
                    equal:"",
                    delim:""
                };
            }
            else if (props.length > 0)
            {
                props[props.length-1].delim = '';
            }
        }
        catch (exc)
        {
            // Sometimes we get exceptions when trying to read from certain objects, like
            // StorageList, but don't let that gum up the works
            // XXXjjb also History.previous fails because object is a web-page object which does not have
            // permission to read the history
        }
        return props;
    },
    
    /*
    propIterator: function (object)
    {
        if (!object)
            return [];

        let props = [];
        let len = 0;

        try
        {
            for (let name in object)
            {
                let val;
                try
                {
                    val = object[name];
                }
                catch (exc)
                {
                    continue;
                }

                let t = typeof val;
                if (t == "boolean" || t == "number" || (t == "string" && val)
                    || (t == "object" && !isFunction(val) && val && val.toString))
                {
                    let title = (t == "object")
                        ? Firebug.getRep(val).getTitle(val)
                        : val+"";

                    len += name.length + title.length + 1;
                    if (len < 50)
                        props.push({name: name, value: title});
                    else
                        break;
                }
            }
        }
        catch (exc)
        {
            // Sometimes we get exceptions when trying to read from certain objects, like
            // StorageList, but don't let that gum up the works
            // XXXjjb also History.previous fails because object is a web-page object which does not have
            // permission to read the history
        }

        return props;
    },
    /**/

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    className: "object",

    supportsObject: function(object, type)
    {
        return true;
    }
});


// ************************************************************************************************

this.Arr = domplate(Firebug.Rep,
{
    tag:
        OBJECTBOX({_repObject: "$object"},
            SPAN({"class": "arrayLeftBracket", role : "presentation"}, "["),
            FOR("item", "$object|arrayIterator",
                TAG("$item.tag", {object: "$item.object"}),
                SPAN({"class": "arrayComma", role : "presentation"}, "$item.delim")
            ),
            SPAN({"class": "arrayRightBracket", role : "presentation"}, "]")
        ),

    shortTag:
        OBJECTBOX({_repObject: "$object"},
            SPAN({"class": "arrayLeftBracket", role : "presentation"}, "["),
            FOR("item", "$object|shortArrayIterator",
                TAG("$item.tag", {object: "$item.object"}),
                SPAN({"class": "arrayComma", role : "presentation"}, "$item.delim")
            ),
            // TODO: xxxpedro - confirm this on Firebug
            //FOR("prop", "$object|shortPropIterator",
            //        " $prop.name=",
            //        SPAN({"class": "objectPropValue"}, "$prop.value|cropString")
            //),
            SPAN({"class": "arrayRightBracket"}, "]")
        ),

    arrayIterator: function(array)
    {
        let items = [];
        for (let i = 0; i < array.length; ++i)
        {
            let value = array[i];
            let rep = Firebug.getRep(value);
            let tag = rep.shortTag ? rep.shortTag : rep.tag;
            let delim = (i == array.length-1 ? "" : ", ");

            items.push({object: value, tag: tag, delim: delim});
        }

        return items;
    },

    shortArrayIterator: function(array)
    {
        let items = [];
        for (let i = 0; i < array.length && i < 3; ++i)
        {
            let value = array[i];
            let rep = Firebug.getRep(value);
            let tag = rep.shortTag ? rep.shortTag : rep.tag;
            let delim = (i == array.length-1 ? "" : ", ");

            items.push({object: value, tag: tag, delim: delim});
        }

        if (array.length > 3)
            items.push({object: (array.length-3) + " more...", tag: FirebugReps.Caption.tag, delim: ""});

        return items;
    },

    shortPropIterator:    this.Obj.propIterator,

    getItemIndex: function(child)
    {
        let arrayIndex = 0;
        for (child = child.previousSibling; child; child = child.previousSibling)
        {
            if (child.repObject)
                ++arrayIndex;
        }
        return arrayIndex;
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    className: "array",

    supportsObject: function(object)
    {
        return this.isArray(object);
    },

    // http://code.google.com/p/fbug/issues/detail?id=874
    // BEGIN Yahoo BSD Source (modified here)  YAHOO.lang.isArray, YUI 2.2.2 June 2007
    isArray: function(obj) {
        try {
            if (!obj)
                return false;
            else if (isIE && !isFunction(obj) && typeof obj == "object" && isFinite(obj.length) && obj.nodeType != 8)
                return true;
            else if (isFinite(obj.length) && isFunction(obj.splice))
                return true;
            else if (isFinite(obj.length) && isFunction(obj.callee)) // arguments
                return true;
            else if (instanceOf(obj, "HTMLCollection"))
                return true;
            else if (instanceOf(obj, "NodeList"))
                return true;
            else
                return false;
        }
        catch(exc)
        {
            if (FBTrace.DBG_ERRORS)
            {
                FBTrace.sysout("isArray FAILS:", exc);  /* Something weird: without the try/catch, OOM, with no exception?? */
                FBTrace.sysout("isArray Fails on obj", obj);
            }
        }

        return false;
    },
    // END Yahoo BSD SOURCE See license below.

    getTitle: function(object, context)
    {
        return "[" + object.length + "]";
    }
});

// ************************************************************************************************

this.Property = domplate(Firebug.Rep,
{
    supportsObject: function(object)
    {
        return object instanceof Property;
    },

    getRealObject: function(prop, context)
    {
        return prop.object[prop.name];
    },

    getTitle: function(prop, context)
    {
        return prop.name;
    }
});

// ************************************************************************************************

this.NetFile = domplate(this.Obj,
{
    supportsObject: function(object)
    {
        return object instanceof Firebug.NetFile;
    },

    browseObject: function(file, context)
    {
        openNewTab(file.href);
        return true;
    },

    getRealObject: function(file, context)
    {
        return null;
    }
});

// ************************************************************************************************

this.Except = domplate(Firebug.Rep,
{
    tag:
        OBJECTBOX({_repObject: "$object"}, "$object.message"),

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    className: "exception",

    supportsObject: function(object)
    {
        return object instanceof ErrorCopy;
    }
});


// ************************************************************************************************

this.Element = domplate(Firebug.Rep,
{
    tag:
        OBJECTLINK(
            "&lt;",
            SPAN({"class": "nodeTag"}, "$object.nodeName|toLowerCase"),
            FOR("attr", "$object|attrIterator",
                "&nbsp;$attr.nodeName=&quot;", SPAN({"class": "nodeValue"}, "$attr.nodeValue"), "&quot;"
            ),
            "&gt;"
         ),

    shortTag:
        OBJECTLINK(
            SPAN({"class": "$object|getVisible"},
                SPAN({"class": "selectorTag"}, "$object|getSelectorTag"),
                SPAN({"class": "selectorId"}, "$object|getSelectorId"),
                SPAN({"class": "selectorClass"}, "$object|getSelectorClass"),
                SPAN({"class": "selectorValue"}, "$object|getValue")
            )
         ),

     getVisible: function(elt)
     {
         return isVisible(elt) ? "" : "selectorHidden";
     },

     getSelectorTag: function(elt)
     {
         return elt.nodeName.toLowerCase();
     },

     getSelectorId: function(elt)
     {
         return elt.id ? "#" + elt.id : "";
     },

     getSelectorClass: function(elt)
     {
         return elt.className ? "." + elt.className.split(" ")[0] : "";
     },

     getValue: function(elt)
     {
         // TODO: xxxpedro
         return "";
        //  let value;
        //  if (elt instanceof HTMLImageElement)
        //      value = getFileName(elt.src);
        //  else if (elt instanceof HTMLAnchorElement)
        //      value = getFileName(elt.href);
        //  else if (elt instanceof HTMLInputElement)
        //      value = elt.value;
        //  else if (elt instanceof HTMLFormElement)
        //      value = getFileName(elt.action);
        //  else if (elt instanceof HTMLScriptElement)
        //      value = getFileName(elt.src);

        //  return value ? " " + cropString(value, 20) : "";
     },

     attrIterator: function(elt)
     {
         let attrs = [];
         let idAttr, classAttr;
         if (elt.attributes)
         {
             for (let i = 0; i < elt.attributes.length; ++i)
             {
                 let attr = elt.attributes[i];
                 if (attr.nodeName && attr.nodeName.indexOf("firebug-") != -1)
                    continue;
                 else if (attr.nodeName == "id")
                     idAttr = attr;
                else if (attr.nodeName == "class")
                    classAttr = attr;
                 else
                     attrs.push(attr);
             }
         }
         if (classAttr)
            attrs.splice(0, 0, classAttr);
         if (idAttr)
            attrs.splice(0, 0, idAttr);
         
         return attrs;
     },

     shortAttrIterator: function(elt)
     {
         let attrs = [];
         if (elt.attributes)
         {
             for (let i = 0; i < elt.attributes.length; ++i)
             {
                 let attr = elt.attributes[i];
                 if (attr.nodeName == "id" || attr.nodeName == "class")
                     attrs.push(attr);
             }
         }

         return attrs;
     },

     getHidden: function(elt)
     {
         return isVisible(elt) ? "" : "nodeHidden";
     },

     getXPath: function(elt)
     {
         return getElementTreeXPath(elt);
     },
     
     // TODO: xxxpedro remove this?
     getNodeText: function(element)
     {
         let text = element.textContent;
         if (Firebug.showFullTextNodes)
            return text;
        else
            return cropString(text, 50);
     },
     /**/

     getNodeTextGroups: function(element)
     {
         let text =  element.textContent;
         if (!Firebug.showFullTextNodes)
         {
             text=cropString(text,50);
         }

         let escapeGroups=[];

         if (Firebug.showTextNodesWithWhitespace)
             escapeGroups.push({
                'group': 'whitespace',
                'class': 'nodeWhiteSpace',
                'extra': {
                    '\t': '_Tab',
                    '\n': '_Para',
                    ' ' : '_Space'
                }
             });
         if (Firebug.showTextNodesWithEntities)
             escapeGroups.push({
                 'group':'text',
                 'class':'nodeTextEntity',
                 'extra':{}
             });

         if (escapeGroups.length)
             return escapeGroupsForEntities(text, escapeGroups);
         else
             return [{str:text,'class':'',extra:''}];
     },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    copyHTML: function(elt)
    {
        let html = getElementXML(elt);
        copyToClipboard(html);
    },

    copyInnerHTML: function(elt)
    {
        copyToClipboard(elt.innerHTML);
    },

    copyXPath: function(elt)
    {
        let xpath = getElementXPath(elt);
        copyToClipboard(xpath);
    },

    persistor: function(context, xpath)
    {
        let elts = xpath
            ? getElementsByXPath(context.window.document, xpath)
            : null;

        return elts && elts.length ? elts[0] : null;
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    className: "element",

    supportsObject: function(object)
    {
        //return object instanceof Element || object.nodeType == 1 && typeof object.nodeName == "string";
        return instanceOf(object, "Element");
    },

    browseObject: function(elt, context)
    {
        let tag = elt.nodeName.toLowerCase();
        if (tag == "script")
            openNewTab(elt.src);
        else if (tag == "link")
            openNewTab(elt.href);
        else if (tag == "a")
            openNewTab(elt.href);
        else if (tag == "img")
            openNewTab(elt.src);

        return true;
    },

    persistObject: function(elt, context)
    {
        let xpath = getElementXPath(elt);

        return bind(this.persistor, top, xpath);
    },

    getTitle: function(element, context)
    {
        return getElementCSSSelector(element);
    },

    getTooltip: function(elt)
    {
        return this.getXPath(elt);
    },

    getContextMenuItems: function(elt, target, context)
    {
        let monitored = areEventsMonitored(elt, null, context);

        return [
            {label: "CopyHTML", command: bindFixed(this.copyHTML, this, elt) },
            {label: "CopyInnerHTML", command: bindFixed(this.copyInnerHTML, this, elt) },
            {label: "CopyXPath", command: bindFixed(this.copyXPath, this, elt) },
            "-",
            {label: "ShowEventsInConsole", type: "checkbox", checked: monitored,
             command: bindFixed(toggleMonitorEvents, FBL, elt, null, monitored, context) },
            "-",
            {label: "ScrollIntoView", command: bindFixed(elt.scrollIntoView, elt) }
        ];
    }
});

// ************************************************************************************************

this.TextNode = domplate(Firebug.Rep,
{
    tag:
        OBJECTLINK(
            "&lt;",
            SPAN({"class": "nodeTag"}, "TextNode"),
            "&nbsp;textContent=&quot;", SPAN({"class": "nodeValue"}, "$object.textContent|cropString"), "&quot;",
            "&gt;"
            ),

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    className: "textNode",

    supportsObject: function(object)
    {
        return object instanceof Text;
    }
});

// ************************************************************************************************

this.Document = domplate(Firebug.Rep,
{
    tag:
        OBJECTLINK("Document ", SPAN({"class": "objectPropValue"}, "$object|getLocation")),

    getLocation: function(doc)
    {
        return doc.location ? getFileName(doc.location.href) : "";
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    className: "object",

    supportsObject: function(object)
    {
        //return object instanceof Document || object instanceof XMLDocument;
        return instanceOf(object, "Document");
    },

    browseObject: function(doc, context)
    {
        openNewTab(doc.location.href);
        return true;
    },

    persistObject: function(doc, context)
    {
        return this.persistor;
    },

    persistor: function(context)
    {
        return context.window.document;
    },

    getTitle: function(win, context)
    {
        return "document";
    },

    getTooltip: function(doc)
    {
        return doc.location.href;
    }
});

// ************************************************************************************************

this.StyleSheet = domplate(Firebug.Rep,
{
    tag:
        OBJECTLINK("StyleSheet ", SPAN({"class": "objectPropValue"}, "$object|getLocation")),

    getLocation: function(styleSheet)
    {
        return getFileName(styleSheet.href);
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    copyURL: function(styleSheet)
    {
        copyToClipboard(styleSheet.href);
    },

    openInTab: function(styleSheet)
    {
        openNewTab(styleSheet.href);
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    className: "object",

    supportsObject: function(object)
    {
        //return object instanceof CSSStyleSheet;
        return instanceOf(object, "CSSStyleSheet");
    },

    browseObject: function(styleSheet, context)
    {
        openNewTab(styleSheet.href);
        return true;
    },

    persistObject: function(styleSheet, context)
    {
        return bind(this.persistor, top, styleSheet.href);
    },

    getTooltip: function(styleSheet)
    {
        return styleSheet.href;
    },

    getContextMenuItems: function(styleSheet, target, context)
    {
        return [
            {label: "CopyLocation", command: bindFixed(this.copyURL, this, styleSheet) },
            "-",
            {label: "OpenInTab", command: bindFixed(this.openInTab, this, styleSheet) }
        ];
    },

    persistor: function(context, href)
    {
        return getStyleSheetByHref(href, context);
    }
});

// ************************************************************************************************

this.Window = domplate(Firebug.Rep,
{
    tag:
        OBJECTLINK("Window ", SPAN({"class": "objectPropValue"}, "$object|getLocation")),

    getLocation: function(win)
    {
        try
        {
            return (win && win.location && !win.closed) ? getFileName(win.location.href) : "";
        }
        catch (exc)
        {
            if (FBTrace.DBG_ERRORS)
                FBTrace.sysout("reps.Window window closed?");
        }
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    className: "object",

    supportsObject: function(object)
    {
        return instanceOf(object, "Window");
    },

    browseObject: function(win, context)
    {
        openNewTab(win.location.href);
        return true;
    },

    persistObject: function(win, context)
    {
        return this.persistor;
    },

    persistor: function(context)
    {
        return context.window;
    },

    getTitle: function(win, context)
    {
        return "window";
    },

    getTooltip: function(win)
    {
        if (win && !win.closed)
            return win.location.href;
    }
});

// ************************************************************************************************

this.Event = domplate(Firebug.Rep,
{
    tag: TAG("$copyEventTag", {object: "$object|copyEvent"}),

    copyEventTag:
        OBJECTLINK("$object|summarizeEvent"),

    summarizeEvent: function(event)
    {
        let info = [event.type, ' '];

        let eventFamily = getEventFamily(event.type);
        if (eventFamily == "mouse")
            info.push("clientX=", event.clientX, ", clientY=", event.clientY);
        else if (eventFamily == "key")
            info.push("charCode=", event.charCode, ", keyCode=", event.keyCode);

        return info.join("");
    },

    copyEvent: function(event)
    {
        return new EventCopy(event);
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    className: "object",

    supportsObject: function(object)
    {
        //return object instanceof Event || object instanceof EventCopy;
        return instanceOf(object, "Event") || instanceOf(object, "EventCopy");
    },

    getTitle: function(event, context)
    {
        return "Event " + event.type;
    }
});

// ************************************************************************************************

this.SourceLink = domplate(Firebug.Rep,
{
    tag:
        OBJECTLINK({$collapsed: "$object|hideSourceLink"}, "$object|getSourceLinkTitle"),

    hideSourceLink: function(sourceLink)
    {
        return sourceLink ? sourceLink.href.indexOf("XPCSafeJSObjectWrapper") != -1 : true;
    },

    getSourceLinkTitle: function(sourceLink)
    {
        if (!sourceLink)
            return "";

        try
        {
            let fileName = getFileName(sourceLink.href);
            fileName = decodeURIComponent(fileName);
            fileName = cropString(fileName, 17);
        }
        catch(exc)
        {
            if (FBTrace.DBG_ERRORS)
                FBTrace.sysout("reps.getSourceLinkTitle decodeURIComponent fails for \'"+fileName+"\': "+exc, exc);
        }
        
        return typeof sourceLink.line == "number" ?
                fileName + " (line " + sourceLink.line + ")" :
                fileName;
        
        // TODO: xxxpedro
        //return $STRF("Line", [fileName, sourceLink.line]);
    },

    copyLink: function(sourceLink)
    {
        copyToClipboard(sourceLink.href);
    },

    openInTab: function(sourceLink)
    {
        openNewTab(sourceLink.href);
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    className: "sourceLink",

    supportsObject: function(object)
    {
        return object instanceof SourceLink;
    },

    getTooltip: function(sourceLink)
    {
        return decodeURI(sourceLink.href);
    },

    inspectObject: function(sourceLink, context)
    {
        if (sourceLink.type == "js")
        {
            let scriptFile = getSourceFileByHref(sourceLink.href, context);
            if (scriptFile)
                return Firebug.chrome.select(sourceLink);
        }
        else if (sourceLink.type == "css")
        {
            // If an object is defined, treat it as the highest priority for
            // inspect actions
            if (sourceLink.object) {
                Firebug.chrome.select(sourceLink.object);
                return;
            }

            let stylesheet = getStyleSheetByHref(sourceLink.href, context);
            if (stylesheet)
            {
                let ownerNode = stylesheet.ownerNode;
                if (ownerNode)
                {
                    Firebug.chrome.select(sourceLink, "html");
                    return;
                }

                let panel = context.getPanel("stylesheet");
                if (panel && panel.getRuleByLine(stylesheet, sourceLink.line))
                    return Firebug.chrome.select(sourceLink);
            }
        }

        // Fallback is to just open the view-source window on the file
        viewSource(sourceLink.href, sourceLink.line);
    },

    browseObject: function(sourceLink, context)
    {
        openNewTab(sourceLink.href);
        return true;
    },

    getContextMenuItems: function(sourceLink, target, context)
    {
        return [
            {label: "CopyLocation", command: bindFixed(this.copyLink, this, sourceLink) },
            "-",
            {label: "OpenInTab", command: bindFixed(this.openInTab, this, sourceLink) }
        ];
    }
});

// ************************************************************************************************

this.SourceFile = domplate(this.SourceLink,
{
    tag:
        OBJECTLINK({$collapsed: "$object|hideSourceLink"}, "$object|getSourceLinkTitle"),

    persistor: function(context, href)
    {
        return getSourceFileByHref(href, context);
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    className: "sourceFile",

    supportsObject: function(object)
    {
        return object instanceof SourceFile;
    },

    persistObject: function(sourceFile)
    {
        return bind(this.persistor, top, sourceFile.href);
    },

    browseObject: function(sourceLink, context)
    {
    },

    getTooltip: function(sourceFile)
    {
        return sourceFile.href;
    }
});

// ************************************************************************************************

this.StackFrame = domplate(Firebug.Rep,  // XXXjjb Since the repObject is fn the stack does not have correct line numbers
{
    tag:
        OBJECTBLOCK(
            A({"class": "objectLink objectLink-function focusRow a11yFocus", _repObject: "$object.fn"}, "$object|getCallName"),
            " ( ",
            FOR("arg", "$object|argIterator",
                TAG("$arg.tag", {object: "$arg.value"}),
                SPAN({"class": "arrayComma"}, "$arg.delim")
            ),
            " )",
            SPAN({"class": "objectLink-sourceLink objectLink"}, "$object|getSourceLinkTitle")
        ),

    getCallName: function(frame)
    {
        //TODO: xxxpedro reps StackFrame
        return frame.name || "anonymous";
        
        //return getFunctionName(frame.script, frame.context);
    },

    getSourceLinkTitle: function(frame)
    {
        //TODO: xxxpedro reps StackFrame
        let fileName = cropString(getFileName(frame.href), 20);
        return fileName + (frame.lineNo ? " (line " + frame.lineNo + ")" : "");
        
        // let fileName = cropString(getFileName(frame.href), 17);
        // return $STRF("Line", [fileName, frame.lineNo]);
    },

    argIterator: function(frame)
    {
        if (!frame.args)
            return [];

        let items = [];

        for (let i = 0; i < frame.args.length; ++i)
        {
            let arg = frame.args[i];

            if (!arg)
                break;

            let rep = Firebug.getRep(arg.value);
            let tag = rep.shortTag ? rep.shortTag : rep.tag;

            let delim = (i == frame.args.length-1 ? "" : ", ");

            items.push({name: arg.name, value: arg.value, tag: tag, delim: delim});
        }

        return items;
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    className: "stackFrame",

    supportsObject: function(object)
    {
        return object instanceof StackFrame;
    },

    inspectObject: function(stackFrame, context)
    {
        let sourceLink = new SourceLink(stackFrame.href, stackFrame.lineNo, "js");
        Firebug.chrome.select(sourceLink);
    },

    getTooltip: function(stackFrame, context)
    {
        return $STRF("Line", [stackFrame.href, stackFrame.lineNo]);
    }

});

// ************************************************************************************************

this.StackTrace = domplate(Firebug.Rep,
{
    tag:
        FOR("frame", "$object.frames focusRow",
            TAG(this.StackFrame.tag, {object: "$frame"})
        ),

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    className: "stackTrace",

    supportsObject: function(object)
    {
        return object instanceof StackTrace;
    }
});

// ************************************************************************************************

this.jsdStackFrame = domplate(Firebug.Rep,
{
    inspectable: false,

    supportsObject: function(object)
    {
        return (object instanceof jsdIStackFrame) && (object.isValid);
    },

    getTitle: function(frame, context)
    {
        if (!frame.isValid) return "(invalid frame)"; // XXXjjb avoid frame.script == null
        return getFunctionName(frame.script, context);
    },

    getTooltip: function(frame, context)
    {
        if (!frame.isValid) return "(invalid frame)";  // XXXjjb avoid frame.script == null
        let sourceInfo = FBL.getSourceFileAndLineByScript(context, frame.script, frame);
        if (sourceInfo)
            return $STRF("Line", [sourceInfo.sourceFile.href, sourceInfo.lineNo]);
        else
            return $STRF("Line", [frame.script.fileName, frame.line]);
    },

    getContextMenuItems: function(frame, target, context)
    {
        let fn = frame.script.functionObject.getWrappedValue();
        return FirebugReps.Func.getContextMenuItems(fn, target, context, frame.script);
    }
});

// ************************************************************************************************

this.ErrorMessage = domplate(Firebug.Rep,
{
    tag:
        OBJECTBOX({
                $hasTwisty: "$object|hasStackTrace",
                $hasBreakSwitch: "$object|hasBreakSwitch",
                $breakForError: "$object|hasErrorBreak",
                _repObject: "$object",
                _stackTrace: "$object|getLastErrorStackTrace",
                onclick: "$onToggleError"},

            DIV({"class": "errorTitle a11yFocus", role : 'checkbox', 'aria-checked' : 'false'},
                "$object.message|getMessage"
            ),
            DIV({"class": "errorTrace"}),
            DIV({"class": "errorSourceBox errorSource-$object|getSourceType"},
                IMG({"class": "errorBreak a11yFocus", src:"blank.gif", role : 'checkbox', 'aria-checked':'false', title: "Break on this error"}),
                A({"class": "errorSource a11yFocus"}, "$object|getLine")
            ),
            TAG(this.SourceLink.tag, {object: "$object|getSourceLink"})
        ),

    getLastErrorStackTrace: function(error)
    {
        return error.trace;
    },

    hasStackTrace: function(error)
    {
        let url = error.href.toString();
        let fromCommandLine = (url.indexOf("XPCSafeJSObjectWrapper") != -1);
        return !fromCommandLine && error.trace;
    },

    hasBreakSwitch: function(error)
    {
        return error.href && error.lineNo > 0;
    },

    hasErrorBreak: function(error)
    {
        return fbs.hasErrorBreakpoint(error.href, error.lineNo);
    },

    getMessage: function(message)
    {
        let re = /\[Exception... "(.*?)" nsresult:/;
        let m = re.exec(message);
        return m ? m[1] : message;
    },

    getLine: function(error)
    {
        if (error.category == "js")
        {
            if (error.source)
                return cropString(error.source, 80);
            else if (error.href && error.href.indexOf("XPCSafeJSObjectWrapper") == -1)
                return cropString(error.getSourceLine(), 80);
        }
    },

    getSourceLink: function(error)
    {
        let ext = error.category == "css" ? "css" : "js";
        return error.lineNo ? new SourceLink(error.href, error.lineNo, ext) : null;
    },

    getSourceType: function(error)
    {
        // Errors occurring inside of HTML event handlers look like "foo.html (line 1)"
        // so let's try to skip those
        if (error.source)
            return "syntax";
        else if (error.lineNo == 1 && getFileExtension(error.href) != "js")
            return "none";
        else if (error.category == "css")
            return "none";
        else if (!error.href || !error.lineNo)
            return "none";
        else
            return "exec";
    },

    onToggleError: function(event)
    {
        let target = event.currentTarget;
        if (hasClass(event.target, "errorBreak"))
        {
            this.breakOnThisError(target.repObject);
        }
        else if (hasClass(event.target, "errorSource"))
        {
            let panel = Firebug.getElementPanel(event.target);
            this.inspectObject(target.repObject, panel.context);
        }
        else if (hasClass(event.target, "errorTitle"))
        {
            let traceBox = target.childNodes[1];
            toggleClass(target, "opened");
            event.target.setAttribute('aria-checked', hasClass(target, "opened"));
            if (hasClass(target, "opened"))
            {
                let node, panel;
                if (target.stackTrace)
                    node = FirebugReps.StackTrace.tag.append({object: target.stackTrace}, traceBox);
                if (Firebug.A11yModel.enabled)
                {
                    panel = Firebug.getElementPanel(event.target);
                    dispatch([Firebug.A11yModel], "onLogRowContentCreated", [panel , traceBox]);
                }
            }
            else
                clearNode(traceBox);
        }
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    copyError: function(error)
    {
        let message = [
            this.getMessage(error.message),
            error.href,
            "Line " +  error.lineNo
        ];
        copyToClipboard(message.join("\n"));
    },

    breakOnThisError: function(error)
    {
        if (this.hasErrorBreak(error))
            Firebug.Debugger.clearErrorBreakpoint(error.href, error.lineNo);
        else
            Firebug.Debugger.setErrorBreakpoint(error.href, error.lineNo);
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    className: "errorMessage",
    inspectable: false,

    supportsObject: function(object)
    {
        return object instanceof ErrorMessage;
    },

    inspectObject: function(error, context)
    {
        let sourceLink = this.getSourceLink(error);
        FirebugReps.SourceLink.inspectObject(sourceLink, context);
    },

    getContextMenuItems: function(error, target, context)
    {
        let breakOnThisError = this.hasErrorBreak(error);

        let items = [
            {label: "CopyError", command: bindFixed(this.copyError, this, error) }
        ];

        if (error.category == "css")
        {
            items.push(
                "-",
                {label: "BreakOnThisError", type: "checkbox", checked: breakOnThisError,
                 command: bindFixed(this.breakOnThisError, this, error) },

                optionMenu("BreakOnAllErrors", "breakOnErrors")
            );
        }

        return items;
    }
});

// ************************************************************************************************

this.Assert = domplate(Firebug.Rep,
{
    tag:
        DIV(
            DIV({"class": "errorTitle"}),
            DIV({"class": "assertDescription"})
        ),

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    className: "assert",

    inspectObject: function(error, context)
    {
        let sourceLink = this.getSourceLink(error);
        Firebug.chrome.select(sourceLink);
    },

    getContextMenuItems: function(error, target, context)
    {
        let breakOnThisError = this.hasErrorBreak(error);

        return [
            {label: "CopyError", command: bindFixed(this.copyError, this, error) },
            "-",
            {label: "BreakOnThisError", type: "checkbox", checked: breakOnThisError,
             command: bindFixed(this.breakOnThisError, this, error) },
            {label: "BreakOnAllErrors", type: "checkbox", checked: Firebug.breakOnErrors,
             command: bindFixed(this.breakOnAllErrors, this, error) }
        ];
    }
});

// ************************************************************************************************

this.SourceText = domplate(Firebug.Rep,
{
    tag:
        DIV(
            FOR("line", "$object|lineIterator",
                DIV({"class": "sourceRow", role : "presentation"},
                    SPAN({"class": "sourceLine", role : "presentation"}, "$line.lineNo"),
                    SPAN({"class": "sourceRowText", role : "presentation"}, "$line.text")
                )
            )
        ),

    lineIterator: function(sourceText)
    {
        let maxLineNoChars = (sourceText.lines.length + "").length;
        let list = [];

        for (let i = 0; i < sourceText.lines.length; ++i)
        {
            // Make sure all line numbers are the same width (with a fixed-width font)
            let lineNo = (i+1) + "";
            while (lineNo.length < maxLineNoChars)
                lineNo = " " + lineNo;

            list.push({lineNo: lineNo, text: sourceText.lines[i]});
        }

        return list;
    },

    getHTML: function(sourceText)
    {
        return getSourceLineRange(sourceText, 1, sourceText.lines.length);
    }
});

//************************************************************************************************
this.nsIDOMHistory = domplate(Firebug.Rep,
{
    tag:OBJECTBOX({onclick: "$showHistory"},
            OBJECTLINK("$object|summarizeHistory")
        ),

    className: "nsIDOMHistory",

    summarizeHistory: function(history)
    {
        try
        {
            let items = history.length;
            return items + " history entries";
        }
        catch(exc)
        {
            return "object does not support history (nsIDOMHistory)";
        }
    },

    showHistory: function(history)
    {
        try
        {
            let items = history.length;  // if this throws, then unsupported
            Firebug.chrome.select(history);
        }
        catch (exc)
        {
        }
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    supportsObject: function(object, type)
    {
        return (object instanceof Ci.nsIDOMHistory);
    }
});

// ************************************************************************************************
this.ApplicationCache = domplate(Firebug.Rep,
{
    tag:OBJECTBOX({onclick: "$showApplicationCache"},
            OBJECTLINK("$object|summarizeCache")
        ),

    summarizeCache: function(applicationCache)
    {
        try
        {
            return applicationCache.length + " items in offline cache";
        }
        catch(exc)
        {
            return "https://bugzilla.mozilla.org/show_bug.cgi?id=422264";
        }
    },

    showApplicationCache: function(event)
    {
        openNewTab("https://bugzilla.mozilla.org/show_bug.cgi?id=422264");
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    className: "applicationCache",

    supportsObject: function(object, type)
    {
        if (Ci.nsIDOMOfflineResourceList)
            return (object instanceof Ci.nsIDOMOfflineResourceList);
    }

});

this.Storage = domplate(Firebug.Rep,
{
    tag: OBJECTBOX({onclick: "$show"}, OBJECTLINK("$object|summarize")),

    summarize: function(storage)
    {
        return storage.length +" items in Storage";
    },
    show: function(storage)
    {
        openNewTab("http://dev.w3.org/html5/webstorage/#storage-0");
    },
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    className: "Storage",

    supportsObject: function(object, type)
    {
        return (object instanceof Storage);
    }

});

// ************************************************************************************************
Firebug.registerRep(
    //this.nsIDOMHistory, // make this early to avoid exceptions
    this.Undefined,
    this.Null,
    this.Number,
    this.String,
    this.Window,
    //this.ApplicationCache, // must come before Arr (array) else exceptions.
    //this.ErrorMessage,
    this.Element,
    //this.TextNode,
    this.Document,
    this.StyleSheet,
    this.Event,
    //this.SourceLink,
    //this.SourceFile,
    //this.StackTrace,
    //this.StackFrame,
    //this.jsdStackFrame,
    //this.jsdScript,
    //this.NetFile,
    this.Property,
    this.Except,
    this.Arr
);

Firebug.setDefaultReps(this.Func, this.Obj);

}});

// ************************************************************************************************
/*
 * The following is http://developer.yahoo.com/yui/license.txt and applies to only code labeled "Yahoo BSD Source"
 * in only this file reps.js.  John J. Barton June 2007.
 *
Software License Agreement (BSD License)

Copyright (c) 2006, Yahoo! Inc.
All rights reserved.

Redistribution and use of this software in source and binary forms, with or without modification, are
permitted provided that the following conditions are met:

* Redistributions of source code must retain the above
  copyright notice, this list of conditions and the
  following disclaimer.

* Redistributions in binary form must reproduce the above
  copyright notice, this list of conditions and the
  following disclaimer in the documentation and/or other
  materials provided with the distribution.

* Neither the name of Yahoo! Inc. nor the names of its
  contributors may be used to endorse or promote products
  derived from this software without specific prior
  written permission of Yahoo! Inc.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED
WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 * /
 */
