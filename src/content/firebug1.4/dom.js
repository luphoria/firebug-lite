/* See license.txt for terms of usage */

FBL.ns(function() { with (FBL) {
// ************************************************************************************************

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

let ElementCache = Firebug.Lite.Cache.Element;

let insertSliceSize = 18;
let insertInterval = 40;

let ignorelets =
{
    "__firebug__": 1,
    "eval": 1,

    // We are forced to ignore Java-related letiables, because
    // trying to access them causes browser freeze
    "java": 1,
    "sun": 1,
    "Packages": 1,
    "JavaArray": 1,
    "JavaMember": 1,
    "JavaObject": 1,
    "JavaClass": 1,
    "JavaPackage": 1,
    "_firebug": 1,
    "_FirebugConsole": 1,
    "_FirebugCommandLine": 1
};

if (Firebug.ignoreFirebugElements)
    ignorelets[Firebug.Lite.Cache.ID] = 1;

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

let memberPanelRep =
    isIE6 ?
    {"class": "memberLabel $member.type\\Label", href: "javacript:void(0)"}
    :
    {"class": "memberLabel $member.type\\Label"};

let RowTag =
    TR({"class": "memberRow $member.open $member.type\\Row", $hasChildren: "$member.hasChildren", role : 'presentation',
        level: "$member.level"},
        TD({"class": "memberLabelCell", style: "padding-left: $member.indent\\px", role : 'presentation'},
            A(memberPanelRep,
                SPAN({}, "$member.name")
            )
        ),
        TD({"class": "memberValueCell", role : 'presentation'},
            TAG("$member.tag", {object: "$member.value"})
        )
    );

let WatchRowTag =
    TR({"class": "watchNewRow", level: 0},
        TD({"class": "watchEditCell", colspan: 2},
            DIV({"class": "watchEditBox a11yFocusNoTab", role: "button", 'tabindex' : '0',
                'aria-label' : $STR('press enter to add new watch expression')},
                    $STR("NewWatch")
            )
        )
    );

let SizerRow =
    TR({role : 'presentation'},
        TD({width: "30%"}),
        TD({width: "70%"})
    );

let domTableClass = isIElt8 ? "domTable domTableIE" : "domTable";
let DirTablePlate = domplate(Firebug.Rep,
{
    tag:
        TABLE({"class": domTableClass, cellpadding: 0, cellspacing: 0, onclick: "$onClick", role :"tree"},
            TBODY({role: 'presentation'},
                SizerRow,
                FOR("member", "$object|memberIterator", RowTag)
            )
        ),
        
    watchTag:
        TABLE({"class": domTableClass, cellpadding: 0, cellspacing: 0,
               _toggles: "$toggles", _domPanel: "$domPanel", onclick: "$onClick", role : 'tree'},
            TBODY({role : 'presentation'},
                SizerRow,
                WatchRowTag
            )
        ),

    tableTag:
        TABLE({"class": domTableClass, cellpadding: 0, cellspacing: 0,
            _toggles: "$toggles", _domPanel: "$domPanel", onclick: "$onClick", role : 'tree'},
            TBODY({role : 'presentation'},
                SizerRow
            )
        ),

    rowTag:
        FOR("member", "$members", RowTag),

    memberIterator: function(object, level)
    {
        return getMembers(object, level);
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    onClick: function(event)
    {
        if (!isLeftClick(event))
            return;
        
        let target = event.target || event.srcElement;

        let row = getAncestorByClass(target, "memberRow");
        let label = getAncestorByClass(target, "memberLabel");
        if (label && hasClass(row, "hasChildren"))
        {
            let row = label.parentNode.parentNode;
            this.toggleRow(row);
        }
        else
        {
            let object = Firebug.getRepObject(target);
            if (typeof(object) == "function")
            {
                Firebug.chrome.select(object, "script");
                cancelEvent(event);
            }
            else if (event.detail == 2 && !object)
            {
                let panel = row.parentNode.parentNode.domPanel;
                if (panel)
                {
                    let rowValue = panel.getRowPropertyValue(row);
                    if (typeof(rowValue) == "boolean")
                        panel.setPropertyValue(row, !rowValue);
                    else
                        panel.editProperty(row);

                    cancelEvent(event);
                }
            }
        }
        
        return false;
    },

    toggleRow: function(row)
    {
        let level = parseInt(row.getAttribute("level"));
        let toggles = row.parentNode.parentNode.toggles;

        if (hasClass(row, "opened"))
        {
            removeClass(row, "opened");

            if (toggles)
            {
                let path = getPath(row);

                // Remove the path from the toggle tree
                for (let i = 0; i < path.length; ++i)
                {
                    if (i == path.length-1)
                        delete toggles[path[i]];
                    else
                        toggles = toggles[path[i]];
                }
            }

            let rowTag = this.rowTag;
            let tbody = row.parentNode;

            setTimeout(function()
            {
                for (let firstRow = row.nextSibling; firstRow; firstRow = row.nextSibling)
                {
                    if (parseInt(firstRow.getAttribute("level")) <= level)
                        break;

                    tbody.removeChild(firstRow);
                }
            }, row.insertTimeout ? row.insertTimeout : 0);
        }
        else
        {
            setClass(row, "opened");

            if (toggles)
            {
                let path = getPath(row);

                // Mark the path in the toggle tree
                for (let i = 0; i < path.length; ++i)
                {
                    let name = path[i];
                    if (toggles.hasOwnProperty(name))
                        toggles = toggles[name];
                    else
                        toggles = toggles[name] = {};
                }
            }

            let value = row.lastChild.firstChild.repObject;
            let members = getMembers(value, level+1);

            let rowTag = this.rowTag;
            let lastRow = row;

            let delay = 0;
            //let setSize = members.length;
            //let rowCount = 1;
            while (members.length)
            {
                with({slice: members.splice(0, insertSliceSize), isLast: !members.length})
                {
                    setTimeout(function()
                    {
                        if (lastRow.parentNode)
                        {
                            let result = rowTag.insertRows({members: slice}, lastRow);
                            lastRow = result[1];
                            //dispatch([Firebug.A11yModel], 'onMemberRowSliceAdded', [null, result, rowCount, setSize]);
                            //rowCount += insertSliceSize;
                        }
                        if (isLast)
                            row.removeAttribute("insertTimeout");
                    }, delay);
                }

                delay += insertInterval;
            }

            row.insertTimeout = delay;
        }
    }
});



// ************************************************************************************************

Firebug.DOMBasePanel = function() {}

Firebug.DOMBasePanel.prototype = extend(Firebug.Panel,
{
    tag: DirTablePlate.tableTag,

    getRealObject: function(object)
    {
        // TODO: Move this to some global location
        // TODO: Unwrapping should be centralized rather than sprinkling it around ad hoc.
        // TODO: We might be able to make this check more authoritative with QueryInterface.
        if (!object) return object;
        if (object.wrappedJSObject) return object.wrappedJSObject;
        return object;
    },

    rebuild: function(update, scrollTop)
    {
        //dispatch([Firebug.A11yModel], 'onBeforeDomUpdateSelection', [this]);
        let members = getMembers(this.selection);
        expandMembers(members, this.toggles, 0, 0);

        this.showMembers(members, update, scrollTop);
        
        //TODO: xxxpedro statusbar
        if (!this.parentPanel)
            updateStatusBar(this);
    },

    showMembers: function(members, update, scrollTop)
    {
        // If we are still in the midst of inserting rows, cancel all pending
        // insertions here - this is a big speedup when stepping in the debugger
        if (this.timeouts)
        {
            for (let i = 0; i < this.timeouts.length; ++i)
                this.context.clearTimeout(this.timeouts[i]);
            delete this.timeouts;
        }

        if (!members.length)
            return this.showEmptyMembers();

        let panelNode = this.panelNode;
        let priorScrollTop = scrollTop == undefined ? panelNode.scrollTop : scrollTop;

        // If we are asked to "update" the current view, then build the new table
        // offscreen and swap it in when it's done
        let offscreen = update && panelNode.firstChild;
        let dest = offscreen ? panelNode.ownerDocument : panelNode;

        let table = this.tag.replace({domPanel: this, toggles: this.toggles}, dest);
        let tbody = table.lastChild;
        let rowTag = DirTablePlate.rowTag;

        // Insert the first slice immediately
        //let slice = members.splice(0, insertSliceSize);
        //let result = rowTag.insertRows({members: slice}, tbody.lastChild);
        
        //let setSize = members.length;
        //let rowCount = 1;
        
        let panel = this;
        let result;
        
        //dispatch([Firebug.A11yModel], 'onMemberRowSliceAdded', [panel, result, rowCount, setSize]);
        let timeouts = [];
        
        let delay = 0;
        
        // enable to measure rendering performance
        let renderStart = new Date().getTime();
        while (members.length)
        {
            with({slice: members.splice(0, insertSliceSize), isLast: !members.length})
            {
                timeouts.push(this.context.setTimeout(function()
                {
                    // TODO: xxxpedro can this be a timing error related to the
                    // "iteration number" approach insted of "duration time"?
                    // avoid error in IE8
                    if (!tbody.lastChild) return;
                    
                    result = rowTag.insertRows({members: slice}, tbody.lastChild);
                    
                    //rowCount += insertSliceSize;
                    //dispatch([Firebug.A11yModel], 'onMemberRowSliceAdded', [panel, result, rowCount, setSize]);
    
                    if ((panelNode.scrollHeight+panelNode.offsetHeight) >= priorScrollTop)
                        panelNode.scrollTop = priorScrollTop;
                    
                    
                    // enable to measure rendering performance
                    //if (isLast) alert(new Date().getTime() - renderStart + "ms");
                    
                    
                }, delay));
    
                delay += insertInterval;
            }
        }

        if (offscreen)
        {
            timeouts.push(this.context.setTimeout(function()
            {
                if (panelNode.firstChild)
                    panelNode.replaceChild(table, panelNode.firstChild);
                else
                    panelNode.appendChild(table);

                // Scroll back to where we were before
                panelNode.scrollTop = priorScrollTop;
            }, delay));
        }
        else
        {
            timeouts.push(this.context.setTimeout(function()
            {
                panelNode.scrollTop = scrollTop == undefined ? 0 : scrollTop;
            }, delay));
        }
        this.timeouts = timeouts;
    },

    /*
    // new
    showMembers: function(members, update, scrollTop)
    {
        // If we are still in the midst of inserting rows, cancel all pending
        // insertions here - this is a big speedup when stepping in the debugger
        if (this.timeouts)
        {
            for (let i = 0; i < this.timeouts.length; ++i)
                this.context.clearTimeout(this.timeouts[i]);
            delete this.timeouts;
        }

        if (!members.length)
            return this.showEmptyMembers();

        let panelNode = this.panelNode;
        let priorScrollTop = scrollTop == undefined ? panelNode.scrollTop : scrollTop;

        // If we are asked to "update" the current view, then build the new table
        // offscreen and swap it in when it's done
        let offscreen = update && panelNode.firstChild;
        let dest = offscreen ? panelNode.ownerDocument : panelNode;

        let table = this.tag.replace({domPanel: this, toggles: this.toggles}, dest);
        let tbody = table.lastChild;
        let rowTag = DirTablePlate.rowTag;

        // Insert the first slice immediately
        //let slice = members.splice(0, insertSliceSize);
        //let result = rowTag.insertRows({members: slice}, tbody.lastChild);
        
        //let setSize = members.length;
        //let rowCount = 1;
        
        let panel = this;
        let result;
        
        //dispatch([Firebug.A11yModel], 'onMemberRowSliceAdded', [panel, result, rowCount, setSize]);
        let timeouts = [];
        
        let delay = 0;
        let _insertSliceSize = insertSliceSize;
        let _insertInterval = insertInterval;

        // enable to measure rendering performance
        let renderStart = new Date().getTime();
        let lastSkip = renderStart, now;
        
        while (members.length)
        {
            with({slice: members.splice(0, _insertSliceSize), isLast: !members.length})
            {
                let _tbody = tbody;
                let _rowTag = rowTag;
                let _panelNode = panelNode;
                let _priorScrollTop = priorScrollTop;
                
                timeouts.push(this.context.setTimeout(function()
                {
                    // TODO: xxxpedro can this be a timing error related to the
                    // "iteration number" approach insted of "duration time"?
                    // avoid error in IE8
                    if (!_tbody.lastChild) return;
                    
                    result = _rowTag.insertRows({members: slice}, _tbody.lastChild);
                    
                    //rowCount += _insertSliceSize;
                    //dispatch([Firebug.A11yModel], 'onMemberRowSliceAdded', [panel, result, rowCount, setSize]);
    
                    if ((_panelNode.scrollHeight + _panelNode.offsetHeight) >= _priorScrollTop)
                        _panelNode.scrollTop = _priorScrollTop;
                    
                    
                    // enable to measure rendering performance
                    //alert("gap: " + (new Date().getTime() - lastSkip)); 
                    //lastSkip = new Date().getTime();
                    
                    //if (isLast) alert("new: " + (new Date().getTime() - renderStart) + "ms");
                    
                }, delay));
    
                delay += _insertInterval;
            }
        }

        if (offscreen)
        {
            timeouts.push(this.context.setTimeout(function()
            {
                if (panelNode.firstChild)
                    panelNode.replaceChild(table, panelNode.firstChild);
                else
                    panelNode.appendChild(table);

                // Scroll back to where we were before
                panelNode.scrollTop = priorScrollTop;
            }, delay));
        }
        else
        {
            timeouts.push(this.context.setTimeout(function()
            {
                panelNode.scrollTop = scrollTop == undefined ? 0 : scrollTop;
            }, delay));
        }
        this.timeouts = timeouts;
    },
    /**/
    
    showEmptyMembers: function()
    {
        FirebugReps.Warning.tag.replace({object: "NoMembersWarning"}, this.panelNode);
    },

    findPathObject: function(object)
    {
        let pathIndex = -1;
        for (let i = 0; i < this.objectPath.length; ++i)
        {
            // IE needs === instead of == or otherwise some objects will
            // be considered equal to different objects, returning the
            // wrong index of the objectPath array
            if (this.getPathObject(i) === object)
                return i;
        }

        return -1;
    },

    getPathObject: function(index)
    {
        let object = this.objectPath[index];
        
        if (object instanceof Property)
            return object.getObject();
        else
            return object;
    },

    getRowObject: function(row)
    {
        let object = getRowOwnerObject(row);
        return object ? object : this.selection;
    },

    getRowPropertyValue: function(row)
    {
        let object = this.getRowObject(row);
        object = this.getRealObject(object);
        if (object)
        {
            let propName = getRowName(row);

            if (object instanceof jsdIStackFrame)
                return Firebug.Debugger.evaluate(propName, this.context);
            else
                return object[propName];
        }
    },
    /*
    copyProperty: function(row)
    {
        let value = this.getRowPropertyValue(row);
        copyToClipboard(value);
    },

    editProperty: function(row, editValue)
    {
        if (hasClass(row, "watchNewRow"))
        {
            if (this.context.stopped)
                Firebug.Editor.startEditing(row, "");
            else if (Firebug.Console.isAlwaysEnabled())  // not stopped in debugger, need command line
            {
                if (Firebug.CommandLine.onCommandLineFocus())
                    Firebug.Editor.startEditing(row, "");
                else
                    row.innerHTML = $STR("warning.Command line blocked?");
            }
            else
                row.innerHTML = $STR("warning.Console must be enabled");
        }
        else if (hasClass(row, "watchRow"))
            Firebug.Editor.startEditing(row, getRowName(row));
        else
        {
            let object = this.getRowObject(row);
            this.context.thisValue = object;

            if (!editValue)
            {
                let propValue = this.getRowPropertyValue(row);

                let type = typeof(propValue);
                if (type == "undefined" || type == "number" || type == "boolean")
                    editValue = propValue;
                else if (type == "string")
                    editValue = "\"" + escapeJS(propValue) + "\"";
                else if (propValue == null)
                    editValue = "null";
                else if (object instanceof Window || object instanceof jsdIStackFrame)
                    editValue = getRowName(row);
                else
                    editValue = "this." + getRowName(row);
            }


            Firebug.Editor.startEditing(row, editValue);
        }
    },

    deleteProperty: function(row)
    {
        if (hasClass(row, "watchRow"))
            this.deleteWatch(row);
        else
        {
            let object = getRowOwnerObject(row);
            if (!object)
                object = this.selection;
            object = this.getRealObject(object);

            if (object)
            {
                let name = getRowName(row);
                try
                {
                    delete object[name];
                }
                catch (exc)
                {
                    return;
                }

                this.rebuild(true);
                this.markChange();
            }
        }
    },

    setPropertyValue: function(row, value)  // value must be string
    {
        if(FBTrace.DBG_DOM)
        {
            FBTrace.sysout("row: "+row);
            FBTrace.sysout("value: "+value+" type "+typeof(value), value);
        }

        let name = getRowName(row);
        if (name == "this")
            return;

        let object = this.getRowObject(row);
        object = this.getRealObject(object);
        if (object && !(object instanceof jsdIStackFrame))
        {
             // unwrappedJSObject.property = unwrappedJSObject
             Firebug.CommandLine.evaluate(value, this.context, object, this.context.getGlobalScope(),
                 function success(result, context)
                 {
                     if (FBTrace.DBG_DOM)
                         FBTrace.sysout("setPropertyValue evaluate success object["+name+"]="+result+" type "+typeof(result), result);
                     object[name] = result;
                 },
                 function failed(exc, context)
                 {
                     try
                     {
                         if (FBTrace.DBG_DOM)
                              FBTrace.sysout("setPropertyValue evaluate failed with exc:"+exc+" object["+name+"]="+value+" type "+typeof(value), exc);
                         // If the value doesn't parse, then just store it as a string.  Some users will
                         // not realize they're supposed to enter a JavaScript expression and just type
                         // literal text
                         object[name] = String(value);  // unwrappedJSobject.property = string
                     }
                     catch (exc)
                     {
                         return;
                     }
                  }
             );
        }
        else if (this.context.stopped)
        {
            try
            {
                Firebug.CommandLine.evaluate(name+"="+value, this.context);
            }
            catch (exc)
            {
                try
                {
                    // See catch block above...
                    object[name] = String(value); // unwrappedJSobject.property = string
                }
                catch (exc)
                {
                    return;
                }
            }
        }

        this.rebuild(true);
        this.markChange();
    },

    highlightRow: function(row)
    {
        if (this.highlightedRow)
            cancelClassTimed(this.highlightedRow, "jumpHighlight", this.context);

        this.highlightedRow = row;

        if (row)
            setClassTimed(row, "jumpHighlight", this.context);
    },/**/

    onMouseMove: function(event)
    {
        let target = event.srcElement || event.target;
        
        let object = getAncestorByClass(target, "objectLink-element");
        object = object ? object.repObject : null;
        
        if(object && instanceOf(object, "Element") && object.nodeType == 1)
        {
            if(object != lastHighlightedObject)
            {
                Firebug.Inspector.drawBoxModel(object);
                object = lastHighlightedObject;
            }
        }
        else
            Firebug.Inspector.hideBoxModel();
        
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // extends Panel

    create: function()
    {
        // TODO: xxxpedro
        this.context = Firebug.browser;
        
        this.objectPath = [];
        this.propertyPath = [];
        this.viewPath = [];
        this.pathIndex = -1;
        this.toggles = {};

        Firebug.Panel.create.apply(this, arguments);
        
        this.panelNode.style.padding = "0 1px";
    },
    
    initialize: function(){
        Firebug.Panel.initialize.apply(this, arguments);
        
        addEvent(this.panelNode, "mousemove", this.onMouseMove);
    },
    
    shutdown: function()
    {
        removeEvent(this.panelNode, "mousemove", this.onMouseMove);
        
        Firebug.Panel.shutdown.apply(this, arguments);
    },

    /*
    destroy: function(state)
    {
        let view = this.viewPath[this.pathIndex];
        if (view && this.panelNode.scrollTop)
            view.scrollTop = this.panelNode.scrollTop;

        if (this.pathIndex)
            state.pathIndex = this.pathIndex;
        if (this.viewPath)
            state.viewPath = this.viewPath;
        if (this.propertyPath)
            state.propertyPath = this.propertyPath;

        if (this.propertyPath.length > 0 && !this.propertyPath[1])
            state.firstSelection = persistObject(this.getPathObject(1), this.context);

        Firebug.Panel.destroy.apply(this, arguments);
    },
    /**/
    
    ishow: function(state)
    {
        if (this.context.loaded && !this.selection)
        {
            if (!state)
            {
                this.select(null);
                return;
            }
            if (state.viewPath)
                this.viewPath = state.viewPath;
            if (state.propertyPath)
                this.propertyPath = state.propertyPath;

            let defaultObject = this.getDefaultSelection(this.context);
            let selectObject = defaultObject; 

            if (state.firstSelection)
            {
                let restored = state.firstSelection(this.context);
                if (restored)
                {
                    selectObject = restored;
                    this.objectPath = [defaultObject, restored];
                }
                else
                    this.objectPath = [defaultObject];
            }
            else
                this.objectPath = [defaultObject];

            if (this.propertyPath.length > 1)
            {
                for (let i = 1; i < this.propertyPath.length; ++i)
                {
                    let name = this.propertyPath[i];
                    if (!name)
                        continue;

                    let object = selectObject;
                    try
                    {
                        selectObject = object[name];
                    }
                    catch (exc)
                    {
                        selectObject = null;
                    }

                    if (selectObject)
                    {
                        this.objectPath.push(new Property(object, name));
                    }
                    else
                    {
                        // If we can't access a property, just stop
                        this.viewPath.splice(i);
                        this.propertyPath.splice(i);
                        this.objectPath.splice(i);
                        selectObject = this.getPathObject(this.objectPath.length-1);
                        break;
                    }
                }
            }

            let selection = state.pathIndex <= this.objectPath.length-1
                ? this.getPathObject(state.pathIndex)
                : this.getPathObject(this.objectPath.length-1);

            this.select(selection);
        }
    },
    /*
    hide: function()
    {
        let view = this.viewPath[this.pathIndex];
        if (view && this.panelNode.scrollTop)
            view.scrollTop = this.panelNode.scrollTop;
    },
    /**/

    supportsObject: function(object)
    {
        if (object == null)
            return 1000;

        if (typeof(object) == "undefined")
            return 1000;
        else if (object instanceof SourceLink)
            return 0;
        else
            return 1; // just agree to support everything but not agressively.
    },

    refresh: function()
    {
        this.rebuild(true);
    },

    updateSelection: function(object)
    {
        let previousIndex = this.pathIndex;
        let previousView = previousIndex == -1 ? null : this.viewPath[previousIndex];

        let newPath = this.pathToAppend;
        delete this.pathToAppend;

        let pathIndex = this.findPathObject(object);
        if (newPath || pathIndex == -1)
        {
            this.toggles = {};

            if (newPath)
            {
                // Remove everything after the point where we are inserting, so we
                // essentially replace it with the new path
                if (previousView)
                {
                    if (this.panelNode.scrollTop)
                        previousView.scrollTop = this.panelNode.scrollTop;

                    let start = previousIndex + 1, 
                        // Opera needs the length argument in splice(), otherwise
                        // it will consider that only one element should be removed
                        length = this.objectPath.length - start;
                    
                    this.objectPath.splice(start, length);
                    this.propertyPath.splice(start, length);
                    this.viewPath.splice(start, length);
                }

                let value = this.getPathObject(previousIndex);
                if (!value)
                {
                    if (FBTrace.DBG_ERRORS)
                        FBTrace.sysout("dom.updateSelection no pathObject for "+previousIndex+"\n");
                    return;
                }

                for (let i = 0, length = newPath.length; i < length; ++i)
                {
                    let name = newPath[i];
                    let object = value;
                    try
                    {
                        value = value[name];
                    }
                    catch(exc)
                    {
                        if (FBTrace.DBG_ERRORS)
                                FBTrace.sysout("dom.updateSelection FAILS at path_i="+i+" for name:"+name+"\n");
                        return;
                    }

                    ++this.pathIndex;
                    this.objectPath.push(new Property(object, name));
                    this.propertyPath.push(name);
                    this.viewPath.push({toggles: this.toggles, scrollTop: 0});
                }
            }
            else
            {
                this.toggles = {};

                let win = Firebug.browser.window;
                //let win = this.context.getGlobalScope();
                if (object === win)
                {
                    this.pathIndex = 0;
                    this.objectPath = [win];
                    this.propertyPath = [null];
                    this.viewPath = [{toggles: this.toggles, scrollTop: 0}];
                }
                else
                {
                    this.pathIndex = 1;
                    this.objectPath = [win, object];
                    this.propertyPath = [null, null];
                    this.viewPath = [
                        {toggles: {}, scrollTop: 0},
                        {toggles: this.toggles, scrollTop: 0}
                    ];
                }
            }

            this.panelNode.scrollTop = 0;
            this.rebuild();
        }
        else
        {
            this.pathIndex = pathIndex;

            let view = this.viewPath[pathIndex];
            this.toggles = view.toggles;

            // Persist the current scroll location
            if (previousView && this.panelNode.scrollTop)
                previousView.scrollTop = this.panelNode.scrollTop;

            this.rebuild(false, view.scrollTop);
        }
    },

    getObjectPath: function(object)
    {
        return this.objectPath;
    },

    getDefaultSelection: function()
    {
        return Firebug.browser.window;
        //return this.context.getGlobalScope();
    }/*,

    updateOption: function(name, value)
    {
        const optionMap = {showUserProps: 1, showUserFuncs: 1, showDOMProps: 1,
            showDOMFuncs: 1, showDOMConstants: 1};
        if ( optionMap.hasOwnProperty(name) )
            this.rebuild(true);
    },

    getOptionsMenuItems: function()
    {
        return [
            optionMenu("ShowUserProps", "showUserProps"),
            optionMenu("ShowUserFuncs", "showUserFuncs"),
            optionMenu("ShowDOMProps", "showDOMProps"),
            optionMenu("ShowDOMFuncs", "showDOMFuncs"),
            optionMenu("ShowDOMConstants", "showDOMConstants"),
            "-",
            {label: "Refresh", command: bindFixed(this.rebuild, this, true) }
        ];
    },

    getContextMenuItems: function(object, target)
    {
        let row = getAncestorByClass(target, "memberRow");

        let items = [];

        if (row)
        {
            let rowName = getRowName(row);
            let rowObject = this.getRowObject(row);
            let rowValue = this.getRowPropertyValue(row);

            let isWatch = hasClass(row, "watchRow");
            let isStackFrame = rowObject instanceof jsdIStackFrame;

            if (typeof(rowValue) == "string" || typeof(rowValue) == "number")
            {
                // Functions already have a copy item in their context menu
                items.push(
                    "-",
                    {label: "CopyValue",
                        command: bindFixed(this.copyProperty, this, row) }
                );
            }

            items.push(
                "-",
                {label: isWatch ? "EditWatch" : (isStackFrame ? "Editletiable" : "EditProperty"),
                    command: bindFixed(this.editProperty, this, row) }
            );

            if (isWatch || (!isStackFrame && !isDOMMember(rowObject, rowName)))
            {
                items.push(
                    {label: isWatch ? "DeleteWatch" : "DeleteProperty",
                        command: bindFixed(this.deleteProperty, this, row) }
                );
            }
        }

        items.push(
            "-",
            {label: "Refresh", command: bindFixed(this.rebuild, this, true) }
        );

        return items;
    },

    getEditor: function(target, value)
    {
        if (!this.editor)
            this.editor = new DOMEditor(this.document);

        return this.editor;
    }/**/
});

// ************************************************************************************************

// TODO: xxxpedro statusbar
let updateStatusBar = function(panel)
{
    let path = panel.propertyPath;
    let index = panel.pathIndex;
    
    let r = [];
    
    for (let i=0, l=path.length; i<l; i++)
    {
        r.push(i==index ? '<a class="fbHover fbButton fbBtnSelected" ' : '<a class="fbHover fbButton" ');
        r.push('pathIndex=');
        r.push(i);
        
        if(isIE6)
            r.push(' href="javascript:void(0)"');
        
        r.push('>');
        r.push(i==0 ? "window" : path[i] || "Object");
        r.push('</a>');
        
        if(i < l-1)
            r.push('<span class="fbStatusSeparator">&gt;</span>');
    }
    panel.statusBarNode.innerHTML = r.join("");
};


let DOMMainPanel = Firebug.DOMPanel = function () {};

Firebug.DOMPanel.DirTable = DirTablePlate;

DOMMainPanel.prototype = extend(Firebug.DOMBasePanel.prototype,
{
    onClickStatusBar: function(event)
    {
        let target = event.srcElement || event.target;
        let element = getAncestorByClass(target, "fbHover");
        
        if(element)
        {
            let pathIndex = element.getAttribute("pathIndex");
            
            if(pathIndex)
            {
                this.select(this.getPathObject(pathIndex));
            }
        }
    },
    
    selectRow: function(row, target)
    {
        if (!target)
            target = row.lastChild.firstChild;

        if (!target || !target.repObject)
            return;

        this.pathToAppend = getPath(row);

        // If the object is inside an array, look up its index
        let valueBox = row.lastChild.firstChild;
        if (hasClass(valueBox, "objectBox-array"))
        {
            let arrayIndex = FirebugReps.Arr.getItemIndex(target);
            this.pathToAppend.push(arrayIndex);
        }

        // Make sure we get a fresh status path for the object, since otherwise
        // it might find the object in the existing path and not refresh it
        //Firebug.chrome.clearStatusPath();

        this.select(target.repObject, true);
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    onClick: function(event)
    {
        let target = event.srcElement || event.target;
        let repNode = Firebug.getRepNode(target);
        if (repNode)
        {
            let row = getAncestorByClass(target, "memberRow");
            if (row)
            {
                this.selectRow(row, repNode);
                cancelEvent(event);
            }
        }
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // extends Panel

    name: "DOM",
    title: "DOM",
    searchable: true,
    statusSeparator: ">",
    
    options: {
        hasToolButtons: true,
        hasStatusBar: true
    },    

    create: function()
    {
        Firebug.DOMBasePanel.prototype.create.apply(this, arguments);
        
        this.onClick = bind(this.onClick, this);
        
        //TODO: xxxpedro
        this.onClickStatusBar = bind(this.onClickStatusBar, this);
        
        this.panelNode.style.padding = "0 1px";
    },

    initialize: function(oldPanelNode)
    {
        //this.panelNode.addEventListener("click", this.onClick, false);
        //dispatch([Firebug.A11yModel], 'onInitializeNode', [this, 'console']);
        
        Firebug.DOMBasePanel.prototype.initialize.apply(this, arguments);
        
        addEvent(this.panelNode, "click", this.onClick);
        
        // TODO: xxxpedro dom 
        this.ishow();
        
        //TODO: xxxpedro
        addEvent(this.statusBarNode, "click", this.onClickStatusBar);        
    },

    shutdown: function()
    {
        //this.panelNode.removeEventListener("click", this.onClick, false);
        //dispatch([Firebug.A11yModel], 'onDestroyNode', [this, 'console']);
        
        removeEvent(this.panelNode, "click", this.onClick);
        
        Firebug.DOMBasePanel.prototype.shutdown.apply(this, arguments);
    }/*,

    search: function(text, reverse)
    {
        if (!text)
        {
            delete this.currentSearch;
            this.highlightRow(null);
            return false;
        }

        let row;
        if (this.currentSearch && text == this.currentSearch.text)
            row = this.currentSearch.findNext(true, undefined, reverse, Firebug.searchCaseSensitive);
        else
        {
            function findRow(node) { return getAncestorByClass(node, "memberRow"); }
            this.currentSearch = new TextSearch(this.panelNode, findRow);
            row = this.currentSearch.find(text, reverse, Firebug.searchCaseSensitive);
        }

        if (row)
        {
            let sel = this.document.defaultView.getSelection();
            sel.removeAllRanges();
            sel.addRange(this.currentSearch.range);

            scrollIntoCenterView(row, this.panelNode);

            this.highlightRow(row);
            dispatch([Firebug.A11yModel], 'onDomSearchMatchFound', [this, text, row]);
            return true;
        }
        else
        {
            dispatch([Firebug.A11yModel], 'onDomSearchMatchFound', [this, text, null]);
            return false;
        }
    }/**/
});

Firebug.registerPanel(DOMMainPanel);


// ************************************************************************************************



// ************************************************************************************************
// Local Helpers

let getMembers = function getMembers(object, level)  // we expect object to be user-level object wrapped in security blanket
{
    if (!level)
        level = 0;

    let ordinals = [], userProps = [], userClasses = [], userFuncs = [],
        domProps = [], domFuncs = [], domConstants = [];

    try
    {
        let domMembers = getDOMMembers(object);
        //let domMembers = {}; // TODO: xxxpedro
        //let domConstantMap = {};  // TODO: xxxpedro

        let insecureObject; // (women)
        if (object.wrappedJSObject)
            insecureObject = object.wrappedJSObject;
        else
            insecureObject = object;

        // IE function prototype is not listed in (for..in)
        if (isIE && isFunction(object))
            addMember("user", userProps, "prototype", object.prototype, level);            
            
        for (let name in insecureObject)  // enumeration is safe
        {
            if (ignorelets[name] == 1)  // javascript.options.strict says ignorelets is undefined.
                continue;

            let val;
            try
            {
                val = insecureObject[name];  // getter is safe
            }
            catch (exc)
            {
                // Sometimes we get exceptions trying to access certain members
                if (FBTrace.DBG_ERRORS && FBTrace.DBG_DOM)
                    FBTrace.sysout("dom.getMembers cannot access "+name, exc);
            }

            let ordinal = parseInt(name);
            if (ordinal || ordinal == 0)
            {
                addMember("ordinal", ordinals, name, val, level);
            }
            else if (isFunction(val))
            {
                if (isClassFunction(val) && !(name in domMembers))
                    addMember("userClass", userClasses, name, val, level);
                else if (name in domMembers)
                    addMember("domFunction", domFuncs, name, val, level, domMembers[name]);
                else
                    addMember("userFunction", userFuncs, name, val, level);
            }
            else
            {
                //TODO: xxxpedro
                /*
                let getterFunction = insecureObject.__lookupGetter__(name),
                    setterFunction = insecureObject.__lookupSetter__(name),
                    prefix = "";

                if(getterFunction && !setterFunction)
                    prefix = "get ";
                /**/
                
                let prefix = "";

                if (name in domMembers && !(name in domConstantMap))
                    addMember("dom", domProps, (prefix+name), val, level, domMembers[name]);
                else if (name in domConstantMap)
                    addMember("dom", domConstants, (prefix+name), val, level);
                else
                    addMember("user", userProps, (prefix+name), val, level);
            }
        }
    }
    catch (exc)
    {
        // Sometimes we get exceptions just from trying to iterate the members
        // of certain objects, like StorageList, but don't let that gum up the works
        throw exc;
        if (FBTrace.DBG_ERRORS && FBTrace.DBG_DOM)
            FBTrace.sysout("dom.getMembers FAILS: ", exc);
        //throw exc;
    }

    function sortName(a, b) { return a.name > b.name ? 1 : -1; }
    function sortOrder(a, b) { return a.order > b.order ? 1 : -1; }

    let members = [];

    members.push.apply(members, ordinals);

    Firebug.showUserProps = true; // TODO: xxxpedro
    Firebug.showUserFuncs = true; // TODO: xxxpedro
    Firebug.showDOMProps = true;
    Firebug.showDOMFuncs = true;
    Firebug.showDOMConstants = true;
    
    if (Firebug.showUserProps)
    {
        userProps.sort(sortName);
        members.push.apply(members, userProps);
    }

    if (Firebug.showUserFuncs)
    {
        userClasses.sort(sortName);
        members.push.apply(members, userClasses);

        userFuncs.sort(sortName);
        members.push.apply(members, userFuncs);
    }

    if (Firebug.showDOMProps)
    {
        domProps.sort(sortName);
        members.push.apply(members, domProps);
    }

    if (Firebug.showDOMFuncs)
    {
        domFuncs.sort(sortName);
        members.push.apply(members, domFuncs);
    }

    if (Firebug.showDOMConstants)
        members.push.apply(members, domConstants);

    return members;
}

function expandMembers(members, toggles, offset, level)  // recursion starts with offset=0, level=0
{
    let expanded = 0;
    for (let i = offset; i < members.length; ++i)
    {
        let member = members[i];
        if (member.level > level)
            break;

        if ( toggles.hasOwnProperty(member.name) )
        {
            member.open = "opened";  // member.level <= level && member.name in toggles.

            let newMembers = getMembers(member.value, level+1);  // sets newMembers.level to level+1

            let args = [i+1, 0];
            args.push.apply(args, newMembers);
            members.splice.apply(members, args);
            
            /*
            if (FBTrace.DBG_DOM)
            {
                FBTrace.sysout("expandMembers member.name", member.name);
                FBTrace.sysout("expandMembers toggles", toggles);
                FBTrace.sysout("expandMembers toggles[member.name]", toggles[member.name]);
                FBTrace.sysout("dom.expandedMembers level: "+level+" member", member);
            }
            /**/

            expanded += newMembers.length;
            i += newMembers.length + expandMembers(members, toggles[member.name], i+1, level+1);
        }
    }

    return expanded;
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *


function isClassFunction(fn)
{
    try
    {
        for (let name in fn.prototype)
            return true;
    } catch (exc) {}
    return false;
}

let hasProperties = function hasProperties(ob)
{
    try
    {
        for (let name in ob)
            return true;
    } catch (exc) {}
    
    // IE function prototype is not listed in (for..in)
    if (isFunction(ob)) return true;
    
    return false;
}

FBL.ErrorCopy = function(message)
{
    this.message = message;
};

let addMember = function addMember(type, props, name, value, level, order)
{
    let rep = Firebug.getRep(value);    // do this first in case a call to instanceof reveals contents
    let tag = rep.shortTag ? rep.shortTag : rep.tag;

    let ErrorCopy = function(){}; //TODO: xxxpedro
    
    let valueType = typeof(value);
    let hasChildren = hasProperties(value) && !(value instanceof ErrorCopy) &&
        (isFunction(value) || (valueType == "object" && value != null)
        || (valueType == "string" && value.length > Firebug.stringCropLength));

    props.push({
        name: name,
        value: value,
        type: type,
        rowClass: "memberRow-"+type,
        open: "",
        order: order,
        level: level,
        indent: level*16,
        hasChildren: hasChildren,
        tag: tag
    });
}

let getWatchRowIndex = function getWatchRowIndex(row)
{
    let index = -1;
    for (; row && hasClass(row, "watchRow"); row = row.previousSibling)
        ++index;
    return index;
}

let getRowName = function getRowName(row)
{
    let node = row.firstChild;
    return node.textContent ? node.textContent : node.innerText;
}

let getRowValue = function getRowValue(row)
{
    return row.lastChild.firstChild.repObject;
}

let getRowOwnerObject = function getRowOwnerObject(row)
{
    let parentRow = getParentRow(row);
    if (parentRow)
        return getRowValue(parentRow);
}

let getParentRow = function getParentRow(row)
{
    let level = parseInt(row.getAttribute("level"))-1;
    for (row = row.previousSibling; row; row = row.previousSibling)
    {
        if (parseInt(row.getAttribute("level")) == level)
            return row;
    }
}

let getPath = function getPath(row)
{
    let name = getRowName(row);
    let path = [name];

    let level = parseInt(row.getAttribute("level"))-1;
    for (row = row.previousSibling; row; row = row.previousSibling)
    {
        if (parseInt(row.getAttribute("level")) == level)
        {
            let name = getRowName(row);
            path.splice(0, 0, name);

            --level;
        }
    }

    return path;
}

// ************************************************************************************************


// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *


// ************************************************************************************************
// DOM Module

Firebug.DOM = extend(Firebug.Module,
{
    getPanel: function()
    {
        return Firebug.chrome ? Firebug.chrome.getPanel("DOM") : null;
    }
});

Firebug.registerModule(Firebug.DOM);


// ************************************************************************************************
// DOM Panel

let lastHighlightedObject;

function DOMSidePanel(){};

DOMSidePanel.prototype = extend(Firebug.DOMBasePanel.prototype,
{
    selectRow: function(row, target)
    {
        if (!target)
            target = row.lastChild.firstChild;

        if (!target || !target.repObject)
            return;

        this.pathToAppend = getPath(row);

        // If the object is inside an array, look up its index
        let valueBox = row.lastChild.firstChild;
        if (hasClass(valueBox, "objectBox-array"))
        {
            let arrayIndex = FirebugReps.Arr.getItemIndex(target);
            this.pathToAppend.push(arrayIndex);
        }

        // Make sure we get a fresh status path for the object, since otherwise
        // it might find the object in the existing path and not refresh it
        //Firebug.chrome.clearStatusPath();

        let object = target.repObject;
        
        if (instanceOf(object, "Element"))
        {
            Firebug.HTML.selectTreeNode(ElementCache(object));
        }
        else
        {
            Firebug.chrome.selectPanel("DOM");
            Firebug.chrome.getPanel("DOM").select(object, true);
        }
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    onClick: function(event)
    {
        /*
        let target = event.srcElement || event.target;
        
        let object = getAncestorByClass(target, "objectLink");
        object = object ? object.repObject : null;
        
        if(!object) return;
        
        if (instanceOf(object, "Element"))
        {
            Firebug.HTML.selectTreeNode(ElementCache(object));
        }
        else
        {
            Firebug.chrome.selectPanel("DOM");
            Firebug.chrome.getPanel("DOM").select(object, true);
        }
        /**/
        
        
        let target = event.srcElement || event.target;
        let repNode = Firebug.getRepNode(target);
        if (repNode)
        {
            let row = getAncestorByClass(target, "memberRow");
            if (row)
            {
                this.selectRow(row, repNode);
                cancelEvent(event);
            }
        }
        /**/
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // extends Panel

    name: "DOMSidePanel",
    parentPanel: "HTML",
    title: "DOM",
    
    options: {
        hasToolButtons: true
    },
    
    isInitialized: false,
    
    create: function()
    {
        Firebug.DOMBasePanel.prototype.create.apply(this, arguments);
        
        this.onClick = bind(this.onClick, this);
    },
    
    initialize: function(){
        Firebug.DOMBasePanel.prototype.initialize.apply(this, arguments);
        
        addEvent(this.panelNode, "click", this.onClick);
        
        // TODO: xxxpedro css2
        let selection = ElementCache.get(FirebugChrome.selectedHTMLElementId);
        if (selection)
            this.select(selection, true);
    },
    
    shutdown: function()
    {
        removeEvent(this.panelNode, "click", this.onClick);
        
        Firebug.DOMBasePanel.prototype.shutdown.apply(this, arguments);
    },
    
    reattach: function(oldChrome)
    {
        //this.isInitialized = oldChrome.getPanel("DOM").isInitialized;
        this.toggles = oldChrome.getPanel("DOMSidePanel").toggles;
    }
    
});

Firebug.registerPanel(DOMSidePanel);


// ************************************************************************************************
}});