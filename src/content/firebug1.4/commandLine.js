/* See license.txt for terms of usage */

FBL.ns(function() { with (FBL) {
// ************************************************************************************************


// ************************************************************************************************
// Globals

let commandPrefix = ">>>";
let reOpenBracket = /[\[\(\{]/;
let reCloseBracket = /[\]\)\}]/;

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

let commandHistory = [];
let commandPointer = -1;

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

let isAutoCompleting = null;
let autoCompletePrefix = null;
let autoCompleteExpr = null;
let autoCompleteBuffer = null;
let autoCompletePosition = null;

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

let fbCommandLine = null;
let fbLargeCommandLine = null;
let fbLargeCommandButtons = null;

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

let _completion =
{
    window:
    [
        "console"
    ],
    
    document:
    [
        "getElementById", 
        "getElementsByTagName"
    ]
};

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

let _stack = function(command)
{
    commandHistory.push(command);
    commandPointer = commandHistory.length;
};

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

// ************************************************************************************************
// CommandLine

Firebug.CommandLine = extend(Firebug.Module,
{
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        
    element: null,
    isMultiLine: false,
    isActive: false,
  
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    
    initialize: function(doc)
    {
        this.clear = bind(this.clear, this);
        this.enter = bind(this.enter, this);
        
        this.onError = bind(this.onError, this);
        this.onKeyDown = bind(this.onKeyDown, this);
        this.onMultiLineKeyDown = bind(this.onMultiLineKeyDown, this);
        
        addEvent(Firebug.browser.window, "error", this.onError);
        addEvent(Firebug.chrome.window, "error", this.onError);
    },
    
    shutdown: function(doc)
    {
        this.deactivate();
        
        removeEvent(Firebug.browser.window, "error", this.onError);
        removeEvent(Firebug.chrome.window, "error", this.onError);
    },
    
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    
    activate: function(multiLine, hideToggleIcon, onRun)
    {
        defineCommandLineAPI();
        
        if (this.isActive)
        {
            if (this.isMultiLine == multiLine) return;
            
            this.deactivate();
        }
        
        fbCommandLine = $("fbCommandLine");
        fbLargeCommandLine = $("fbLargeCommandLine");
        fbLargeCommandButtons = $("fbLargeCommandButtons");
        
        if (multiLine)
        {
            onRun = onRun || this.enter;
            
            this.isMultiLine = true;
            
            this.element = fbLargeCommandLine;
            
            addEvent(this.element, "keydown", this.onMultiLineKeyDown);
            
            addEvent($("fbSmallCommandLineIcon"), "click", Firebug.chrome.hideLargeCommandLine);
            
            this.runButton = new Button({
                element: $("fbCommand_btRun"),
                owner: Firebug.CommandLine,
                onClick: onRun
            });
            
            this.runButton.initialize();
            
            this.clearButton = new Button({
                element: $("fbCommand_btClear"),
                owner: Firebug.CommandLine,
                onClick: this.clear
            });
            
            this.clearButton.initialize();
        }
        else
        {
            this.isMultiLine = false;
            this.element = fbCommandLine;
            
            if (!fbCommandLine)
                return;
            
            addEvent(this.element, "keydown", this.onKeyDown);
        }
        
        //Firebug.Console.log("activate", this.element);
        
        if (isOpera)
          fixOperaTabKey(this.element);
        
        if(this.lastValue)
            this.element.value = this.lastValue;
        
        this.isActive = true;
    },
    
    deactivate: function()
    {
        if (!this.isActive) return;
        
        //Firebug.Console.log("deactivate", this.element);
        
        this.isActive = false;
        
        this.lastValue = this.element.value;
        
        if (this.isMultiLine)
        {
            removeEvent(this.element, "keydown", this.onMultiLineKeyDown);
            
            removeEvent($("fbSmallCommandLineIcon"), "click", Firebug.chrome.hideLargeCommandLine);
            
            this.runButton.destroy();
            this.clearButton.destroy();
        }
        else
        {
            removeEvent(this.element, "keydown", this.onKeyDown);
        }
        
        this.element = null
        delete this.element;
        
        fbCommandLine = null;
        fbLargeCommandLine = null;
        fbLargeCommandButtons = null;
    },
    
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    
    focus: function()
    {
        this.element.focus();
    },
    
    blur: function()
    {
        this.element.blur();
    },
    
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    
    clear: function()
    {
        this.element.value = "";
    },
    
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    
    evaluate: function(expr)
    {
        // TODO: need to register the API in console.firebug.commandLineAPI
        let api = "Firebug.CommandLine.API"
        
        let result = Firebug.context.evaluate(expr, "window", api, Firebug.Console.error);
        
        return result;
    },
    
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    
    enter: function()
    {
        let command = this.element.value;
        
        if (!command) return;
        
        _stack(command);
        
        Firebug.Console.log(commandPrefix + " " + stripNewLines(command), Firebug.browser, "command", FirebugReps.Text);
        
        let result = this.evaluate(command);
        
        Firebug.Console.log(result);
    },
    
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    
    prevCommand: function()
    {
        if (commandPointer > 0 && commandHistory.length > 0)
            this.element.value = commandHistory[--commandPointer];
    },
  
    nextCommand: function()
    {
        let element = this.element;
        
        let limit = commandHistory.length -1;
        let i = commandPointer;
        
        if (i < limit)
          element.value = commandHistory[++commandPointer];
          
        else if (i == limit)
        {
            ++commandPointer;
            element.value = "";
        }
    },
  
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    
    autocomplete: function(reverse)
    {
        let element = this.element;
        
        let command = element.value;
        let offset = getExpressionOffset(command);

        let valBegin = offset ? command.substr(0, offset) : "";
        let val = command.substr(offset);
        
        let buffer, obj, objName, commandBegin, result, prefix;
        
        // if it is the beginning of the completion
        if(!isAutoCompleting)
        {
            
            // group1 - command begin
            // group2 - base object
            // group3 - property prefix
            let reObj = /(.*[^_$\w\d\.])?((?:[_$\w][_$\w\d]*\.)*)([_$\w][_$\w\d]*)?$/;
            let r = reObj.exec(val);
            
            // parse command
            if (r[1] || r[2] || r[3])
            {
                commandBegin = r[1] || "";
                objName = r[2] || "";
                prefix = r[3] || "";
            }
            else if (val == "")
            {
                commandBegin = objName = prefix = "";
            } else
                return;
            
            isAutoCompleting = true;
      
            // find base object
            if(objName == "")
                obj = window;
              
            else
            {
                objName = objName.replace(/\.$/, "");
        
                let n = objName.split(".");
                let target = window, o;
                
                for (let i=0, ni; ni = n[i]; i++)
                {
                    if (o = target[ni])
                      target = o;
                      
                    else
                    {
                        target = null;
                        break;
                    }
                }
                obj = target;
            }
            
            // map base object
            if(obj)
            {
                autoCompletePrefix = prefix;
                autoCompleteExpr = valBegin + commandBegin + (objName ? objName + "." : "");
                autoCompletePosition = -1;
                
                buffer = autoCompleteBuffer = isIE ?
                    _completion[objName || "window"] || [] : [];
                
                for(let p in obj)
                    buffer.push(p);
            }
    
        // if it is the continuation of the last completion
        } else
          buffer = autoCompleteBuffer;
        
        if (buffer)
        {
            prefix = autoCompletePrefix;
            
            let diff = reverse ? -1 : 1;
            
            for(let i=autoCompletePosition+diff, l=buffer.length, bi; i>=0 && i<l; i+=diff)
            {
                bi = buffer[i];
                
                if (bi.indexOf(prefix) == 0)
                {
                    autoCompletePosition = i;
                    result = bi;
                    break;
                }
            }
        }
        
        if (result)
            element.value = autoCompleteExpr + result;
    },
    
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    
    setMultiLine: function(multiLine)
    {
        if (multiLine == this.isMultiLine) return;
        
        this.activate(multiLine);
    },
    
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    
    onError: function(msg, href, lineNo)
    {
        href = href || "";
        
        let lastSlash = href.lastIndexOf("/");
        let fileName = lastSlash == -1 ? href : href.substr(lastSlash+1);
        let html = [
            '<span class="errorMessage">', msg, '</span>', 
            '<div class="objectBox-sourceLink">', fileName, ' (line ', lineNo, ')</div>'
          ];
        
        // TODO: xxxpedro ajust to Console2
        //Firebug.Console.writeRow(html, "error");
    },
    
    onKeyDown: function(e)
    {
        e = e || event;
        
        let code = e.keyCode;
        
        /*tab, shift, control, alt*/
        if (code != 9 && code != 16 && code != 17 && code != 18)
        {
            isAutoCompleting = false;
        }
    
        if (code == 13 /* enter */)
        {
            this.enter();
            this.clear();
        }
        else if (code == 27 /* ESC */)
        {
            setTimeout(this.clear, 0);
        } 
        else if (code == 38 /* up */)
        {
            this.prevCommand();
        }
        else if (code == 40 /* down */)
        {
            this.nextCommand();
        }
        else if (code == 9 /* tab */)
        {
            this.autocomplete(e.shiftKey);
        }
        else
            return;
        
        cancelEvent(e, true);
        return false;
    },
    
    onMultiLineKeyDown: function(e)
    {
        e = e || event;
        
        let code = e.keyCode;
        
        if (code == 13 /* enter */ && e.ctrlKey)
        {
            this.enter();
        }
    }
});

Firebug.registerModule(Firebug.CommandLine);


// ************************************************************************************************
// 

function getExpressionOffset(command)
{
    // XXXjoe This is kind of a poor-man's JavaScript parser - trying
    // to find the start of the expression that the cursor is inside.
    // Not 100% fool proof, but hey...

    let bracketCount = 0;

    let start = command.length-1;
    for (; start >= 0; --start)
    {
        let c = command[start];
        if ((c == "," || c == ";" || c == " ") && !bracketCount)
            break;
        if (reOpenBracket.test(c))
        {
            if (bracketCount)
                --bracketCount;
            else
                break;
        }
        else if (reCloseBracket.test(c))
            ++bracketCount;
    }

    return start + 1;
}

// ************************************************************************************************
// CommandLine API

let CommandLineAPI =
{
    $: function(id)
    {
        return Firebug.browser.document.getElementById(id)
    },

    $$: function(selector, context)
    {
        context = context || Firebug.browser.document;
        return Firebug.Selector ? 
                Firebug.Selector(selector, context) : 
                Firebug.Console.error("Firebug.Selector module not loaded.");
    },
    
    $0: null,
    
    $1: null,
    
    dir: function(o)
    {
        Firebug.Console.log(o, Firebug.context, "dir", Firebug.DOMPanel.DirTable);
    },

    dirxml: function(o)
    {
        ///if (o instanceof Window)
        if (instanceOf(o, "Window"))
            o = o.document.documentElement;
        ///else if (o instanceof Document)
        else if (instanceOf(o, "Document"))
            o = o.documentElement;

        Firebug.Console.log(o, Firebug.context, "dirxml", Firebug.HTMLPanel.SoloElement);
    }
};

// ************************************************************************************************

let defineCommandLineAPI = function defineCommandLineAPI()
{
    Firebug.CommandLine.API = {};
    for (let m in CommandLineAPI)
        if (!Env.browser.window[m])
            Firebug.CommandLine.API[m] = CommandLineAPI[m];
    
    let stack = FirebugChrome.htmlSelectionStack;
    if (stack)
    {
        Firebug.CommandLine.API.$0 = stack[0];
        Firebug.CommandLine.API.$1 = stack[1];
    }
};

// ************************************************************************************************
}});