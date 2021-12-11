/* See license.txt for terms of usage */

FBL.ns(function() { with (FBL) {

// ************************************************************************************************
// Constants

//const Cc = Components.classes;
//const Ci = Components.interfaces;
    
let frameCounters = {};
let traceRecursion = 0;

Firebug.Console.injector =
{
    install: function(context)
    {
        let win = context.window;
        
        let consoleHandler = new FirebugConsoleHandler(context, win);
        
        let properties = 
        [
            "log",
            "debug",
            "info",
            "warn",
            "error",
            "assert",
            "dir",
            "dirxml",
            "group",
            "groupCollapsed",
            "groupEnd",
            "time",
            "timeEnd",
            "count",
            "trace",
            "profile",
            "profileEnd",
            "clear",
            "open",
            "close"
        ];
        
        let Handler = function(name)
        {
            let c = consoleHandler;
            let f = consoleHandler[name];
            return function(){return f.apply(c,arguments)};
        };
        
        let installer = function(c)
        {
            for (let i=0, l=properties.length; i<l; i++)
            {
                let name = properties[i];
                c[name] = new Handler(name);
                c.firebuglite = Firebug.version;
            }
        };
        
        let consoleNS = (!isFirefox || isFirefox && !("console" in win)) ? "console" : "firebug";
        let sandbox = new win.Function("arguments.callee.install(window." + consoleNS + "={})");
        sandbox.install = installer;
        sandbox();
    },
    
    isAttached: function(context, win)
    {
        if (win.wrappedJSObject)
        {
            let attached = (win.wrappedJSObject._getFirebugConsoleElement ? true : false);
            if (FBTrace.DBG_CONSOLE)
                FBTrace.sysout("Console.isAttached:"+attached+" to win.wrappedJSObject "+safeGetWindowLocation(win.wrappedJSObject));

            return attached;
        }
        else
        {
            if (FBTrace.DBG_CONSOLE)
                FBTrace.sysout("Console.isAttached? to win "+win.location+" fnc:"+win._getFirebugConsoleElement);
            return (win._getFirebugConsoleElement ? true : false);
        }
    },

    attachIfNeeded: function(context, win)
    {
        if (FBTrace.DBG_CONSOLE)
            FBTrace.sysout("Console.attachIfNeeded has win "+(win? ((win.wrappedJSObject?"YES":"NO")+" wrappedJSObject"):"null") );

        if (this.isAttached(context, win))
            return true;

        if (FBTrace.DBG_CONSOLE)
            FBTrace.sysout("Console.attachIfNeeded found isAttached false ");

        this.attachConsoleInjector(context, win);
        this.addConsoleListener(context, win);

        Firebug.Console.clearReloadWarning(context);

        let attached =  this.isAttached(context, win);
        if (attached)
            dispatch(Firebug.Console.fbListeners, "onConsoleInjected", [context, win]);

        return attached;
    },

    attachConsoleInjector: function(context, win)
    {
        let consoleInjection = this.getConsoleInjectionScript();  // Do it all here.

        if (FBTrace.DBG_CONSOLE)
            FBTrace.sysout("attachConsoleInjector evaluating in "+win.location, consoleInjection);

        Firebug.CommandLine.evaluateInWebPage(consoleInjection, context, win);

        if (FBTrace.DBG_CONSOLE)
            FBTrace.sysout("attachConsoleInjector evaluation completed for "+win.location);
    },

    getConsoleInjectionScript: function() {
        if (!this.consoleInjectionScript)
        {
            let script = "";
            script += "window.__defineGetter__('console', function() {\n";
            script += " return (window._firebug ? window._firebug : window.loadFirebugConsole()); })\n\n";

            script += "window.loadFirebugConsole = function() {\n";
            script += "window._firebug =  new _FirebugConsole();";

            if (FBTrace.DBG_CONSOLE)
                script += " window.dump('loadFirebugConsole '+window.location+'\\n');\n";

            script += " return window._firebug };\n";

            let theFirebugConsoleScript = getResource("chrome://firebug/content/consoleInjected.js");
            script += theFirebugConsoleScript;


            this.consoleInjectionScript = script;
        }
        return this.consoleInjectionScript;
    },

    forceConsoleCompilationInPage: function(context, win)
    {
        if (!win)
        {
            if (FBTrace.DBG_CONSOLE)
                FBTrace.sysout("no win in forceConsoleCompilationInPage!");
            return;
        }

        let consoleForcer = "window.loadFirebugConsole();";

        if (context.stopped)
            Firebug.Console.injector.evaluateConsoleScript(context);  // todo evaluate consoleForcer on stack
        else
            Firebug.CommandLine.evaluateInWebPage(consoleForcer, context, win);

        if (FBTrace.DBG_CONSOLE)
            FBTrace.sysout("forceConsoleCompilationInPage "+win.location, consoleForcer);
    },

    evaluateConsoleScript: function(context)
    {
        let scriptSource = this.getConsoleInjectionScript(); // TODO XXXjjb this should be getConsoleInjectionScript
        Firebug.Debugger.evaluate(scriptSource, context);
    },

    addConsoleListener: function(context, win)
    {
        if (!context.activeConsoleHandlers)  // then we have not been this way before
            context.activeConsoleHandlers = [];
        else
        {   // we've been this way before...
            for (let i=0; i<context.activeConsoleHandlers.length; i++)
            {
                if (context.activeConsoleHandlers[i].window == win)
                {
                    context.activeConsoleHandlers[i].detach();
                    if (FBTrace.DBG_CONSOLE)
                        FBTrace.sysout("consoleInjector addConsoleListener removed handler("+context.activeConsoleHandlers[i].handler_name+") from _firebugConsole in : "+win.location+"\n");
                    context.activeConsoleHandlers.splice(i,1);
                }
            }
        }

        // We need the element to attach our event listener.
        let element = Firebug.Console.getFirebugConsoleElement(context, win);
        if (element)
            element.setAttribute("FirebugVersion", Firebug.version); // Initialize Firebug version.
        else
            return false;

        let handler = new FirebugConsoleHandler(context, win);
        handler.attachTo(element);

        context.activeConsoleHandlers.push(handler);

        if (FBTrace.DBG_CONSOLE)
            FBTrace.sysout("consoleInjector addConsoleListener attached handler("+handler.handler_name+") to _firebugConsole in : "+win.location+"\n");
        return true;
    },

    detachConsole: function(context, win)
    {
        if (win && win.document)
        {
            let element = win.document.getElementById("_firebugConsole");
            if (element)
                element.parentNode.removeChild(element);
        }
    }
}

let total_handlers = 0;
let FirebugConsoleHandler = function FirebugConsoleHandler(context, win)
{
    this.window = win;

    this.attachTo = function(element)
    {
        this.element = element;
        // When raised on our injected element, callback to Firebug and append to console
        this.boundHandler = bind(this.handleEvent, this);
        this.element.addEventListener('firebugAppendConsole', this.boundHandler, true); // capturing
    };

    this.detach = function()
    {
        this.element.removeEventListener('firebugAppendConsole', this.boundHandler, true);
    };

    this.handler_name = ++total_handlers;
    this.handleEvent = function(event)
    {
        if (FBTrace.DBG_CONSOLE)
            FBTrace.sysout("FirebugConsoleHandler("+this.handler_name+") "+event.target.getAttribute("methodName")+", event", event);
        if (!Firebug.CommandLine.CommandHandler.handle(event, this, win))
        {
            if (FBTrace.DBG_CONSOLE)
                FBTrace.sysout("FirebugConsoleHandler", this);

            let methodName = event.target.getAttribute("methodName");
            Firebug.Console.log($STRF("console.MethodNotSupported", [methodName]));
        }
    };

    this.firebuglite = Firebug.version;    

    this.init = function()
    {
        let consoleElement = win.document.getElementById('_firebugConsole');
        consoleElement.setAttribute("FirebugVersion", Firebug.version);
    };

    this.log = function()
    {
        logFormatted(arguments, "log");
    };

    this.debug = function()
    {
        logFormatted(arguments, "debug", true);
    };

    this.info = function()
    {
        logFormatted(arguments, "info", true);
    };

    this.warn = function()
    {
        logFormatted(arguments, "warn", true);
    };

    this.error = function()
    {
        //TODO: xxxpedro console error
        //if (arguments.length == 1)
        //{
        //    logAssert("error", arguments);  // add more info based on stack trace
        //}
        //else
        //{
            //Firebug.Errors.increaseCount(context);
            logFormatted(arguments, "error", true);  // user already added info
        //}
    };

    this.exception = function()
    {
        logAssert("error", arguments);
    };

    this.assert = function(x)
    {
        if (!x)
        {
            let rest = [];
            for (let i = 1; i < arguments.length; i++)
                rest.push(arguments[i]);
            logAssert("assert", rest);
        }
    };

    this.dir = function(o)
    {
        Firebug.Console.log(o, context, "dir", Firebug.DOMPanel.DirTable);
    };

    this.dirxml = function(o)
    {
        ///if (o instanceof Window)
        if (instanceOf(o, "Window"))
            o = o.document.documentElement;
        ///else if (o instanceof Document)
        else if (instanceOf(o, "Document"))
            o = o.documentElement;

        Firebug.Console.log(o, context, "dirxml", Firebug.HTMLPanel.SoloElement);
    };

    this.group = function()
    {
        //TODO: xxxpedro;
        //let sourceLink = getStackLink();
        let sourceLink = null;
        Firebug.Console.openGroup(arguments, null, "group", null, false, sourceLink);
    };

    this.groupEnd = function()
    {
        Firebug.Console.closeGroup(context);
    };

    this.groupCollapsed = function()
    {
        let sourceLink = getStackLink();
        // noThrottle true is probably ok, openGroups will likely be short strings.
        let row = Firebug.Console.openGroup(arguments, null, "group", null, true, sourceLink);
        removeClass(row, "opened");
    };

    this.profile = function(title)
    {
        logFormatted(["console.profile() not supported."], "warn", true);
        
        //Firebug.Profiler.startProfiling(context, title);
    };

    this.profileEnd = function()
    {
        logFormatted(["console.profile() not supported."], "warn", true);
        
        //Firebug.Profiler.stopProfiling(context);
    };

    this.count = function(key)
    {
        // TODO: xxxpedro console2: is there a better way to find a unique ID for the coun() call?
        let frameId = "0";
        //let frameId = FBL.getStackFrameId();
        if (frameId)
        {
            if (!frameCounters)
                frameCounters = {};

            if (key != undefined)
                frameId += key;

            let frameCounter = frameCounters[frameId];
            if (!frameCounter)
            {
                let logRow = logFormatted(["0"], null, true, true);

                frameCounter = {logRow: logRow, count: 1};
                frameCounters[frameId] = frameCounter;
            }
            else
                ++frameCounter.count;

            let label = key == undefined
                ? frameCounter.count
                : key + " " + frameCounter.count;

            frameCounter.logRow.firstChild.firstChild.nodeValue = label;
        }
    };

    this.trace = function()
    {
        let getFuncName = function getFuncName (f)
        {
            if (f.getName instanceof Function)
            {
                return f.getName();
            }
            if (f.name) // in FireFox, Function objects have a name property...
            {
                return f.name;
            }
            
            let name = f.toString().match(/function\s*([_$\w\d]*)/)[1];
            return name || "anonymous";
        };
        
        let wasVisited = function(fn)
        {
            for (let i=0, l=frames.length; i<l; i++)
            {
                if (frames[i].fn == fn)
                {
                    return true;
                }
            }
            
            return false;
        };
        
        traceRecursion++;
        
        if (traceRecursion > 1)
        {
            traceRecursion--;
            return;
        }
    
        let frames = [];
        
        for (let fn = arguments.callee.caller.caller; fn; fn = fn.caller)
        {
            if (wasVisited(fn)) break;
            
            let args = [];
            
            for (let i = 0, l = fn.arguments.length; i < l; ++i)
            {
                args.push({value: fn.arguments[i]});
            }

            frames.push({fn: fn, name: getFuncName(fn), args: args});
        }
        
        
        // ****************************************************************************************
        
        try
        {
            (0)();
        }
        catch(e)
        {
            let result = e;
            
            let stack = 
                result.stack || // Firefox / Google Chrome 
                result.stacktrace || // Opera
                "";
            
            stack = stack.replace(/\n\r|\r\n/g, "\n"); // normalize line breaks
            let items = stack.split(/[\n\r]/);
            
            // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
            // Google Chrome
            if (FBL.isSafari)
            {
                //let reChromeStackItem = /^\s+at\s+([^\(]+)\s\((.*)\)$/;
                //let reChromeStackItem = /^\s+at\s+(.*)((?:http|https|ftp|file):\/\/.*)$/;
                let reChromeStackItem = /^\s+at\s+(.*)((?:http|https|ftp|file):\/\/.*)$/;
                
                let reChromeStackItemName = /\s*\($/;
                let reChromeStackItemValue = /^(.+)\:(\d+\:\d+)\)?$/;
                
                let framePos = 0;
                for (let i=4, length=items.length; i<length; i++, framePos++)
                {
                    let frame = frames[framePos];
                    let item = items[i];
                    let match = item.match(reChromeStackItem);
                    
                    //Firebug.Console.log("["+ framePos +"]--------------------------");
                    //Firebug.Console.log(item);
                    //Firebug.Console.log("................");
                    
                    if (match)
                    {
                        let name = match[1];
                        if (name)
                        {
                            name = name.replace(reChromeStackItemName, "");
                            frame.name = name; 
                        }
                        
                        //Firebug.Console.log("name: "+name);
                        
                        let value = match[2].match(reChromeStackItemValue);
                        if (value)
                        {
                            frame.href = value[1];
                            frame.lineNo = value[2];
                            
                            //Firebug.Console.log("url: "+value[1]);
                            //Firebug.Console.log("line: "+value[2]);
                        }
                        //else
                        //    Firebug.Console.log(match[2]);
                        
                    }                
                }
            }
            /**/
            
            // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
            else if (FBL.isFirefox)
            {
                // Firefox
                let reFirefoxStackItem = /^(.*)@(.*)$/;
                let reFirefoxStackItemValue = /^(.+)\:(\d+)$/;
                
                let framePos = 0;
                for (let i=2, length=items.length; i<length; i++, framePos++)
                {
                    let frame = frames[framePos] || {};
                    let item = items[i];
                    let match = item.match(reFirefoxStackItem);
                    
                    if (match)
                    {
                        let name = match[1];
                        
                        //Firebug.Console.logFormatted("name: "+name);
                        
                        let value = match[2].match(reFirefoxStackItemValue);
                        if (value)
                        {
                            frame.href = value[1];
                            frame.lineNo = value[2];
                            
                            //Firebug.Console.log("href: "+ value[1]);
                            //Firebug.Console.log("line: " + value[2]);
                        }
                        //else
                        //    Firebug.Console.logFormatted([match[2]]);
                    }                
                }
            }
            /**/
            
            // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
            /*
            else if (FBL.isOpera)
            {
                // Opera
                let reOperaStackItem = /^\s\s(?:\.\.\.\s\s)?Line\s(\d+)\sof\s(.+)$/;
                let reOperaStackItemValue = /^linked\sscript\s(.+)$/;
                
                for (let i=0, length=items.length; i<length; i+=2)
                {
                    let item = items[i];
                    
                    let match = item.match(reOperaStackItem);
                    
                    if (match)
                    {
                        //Firebug.Console.log(match[1]);
                        
                        let value = match[2].match(reOperaStackItemValue);
                        
                        if (value)
                        {
                            //Firebug.Console.log(value[1]);
                        }
                        //else
                        //    Firebug.Console.log(match[2]);
                        
                        //Firebug.Console.log("--------------------------");
                    }                
                }
            }
            /**/
        }
        
        //console.log(stack);
        //console.dir(frames);
        Firebug.Console.log({frames: frames}, context, "stackTrace", FirebugReps.StackTrace);
        
        traceRecursion--;
    };
    
    this.trace_ok = function()
    {
        let getFuncName = function getFuncName (f)
        {
            if (f.getName instanceof Function)
                return f.getName();
            if (f.name) // in FireFox, Function objects have a name property...
                return f.name;
            
            let name = f.toString().match(/function\s*([_$\w\d]*)/)[1];
            return name || "anonymous";
        };
        
        let wasVisited = function(fn)
        {
            for (let i=0, l=frames.length; i<l; i++)
            {
                if (frames[i].fn == fn)
                    return true;
            }
            
            return false;
        };
    
        let frames = [];
        
        for (let fn = arguments.callee.caller; fn; fn = fn.caller)
        {
            if (wasVisited(fn)) break;
            
            let args = [];
            
            for (let i = 0, l = fn.arguments.length; i < l; ++i)
            {
                args.push({value: fn.arguments[i]});
            }

            frames.push({fn: fn, name: getFuncName(fn), args: args});
        }
        
        Firebug.Console.log({frames: frames}, context, "stackTrace", FirebugReps.StackTrace);
    };
    
    this.clear = function()
    {
        Firebug.Console.clear(context);
    };

    this.time = function(name, reset)
    {
        if (!name)
            return;

        let time = new Date().getTime();

        if (!this.timeCounters)
            this.timeCounters = {};

        let key = "KEY"+name.toString();

        if (!reset && this.timeCounters[key])
            return;

        this.timeCounters[key] = time;
    };

    this.timeEnd = function(name)
    {
        let time = new Date().getTime();

        if (!this.timeCounters)
            return;

        let key = "KEY"+name.toString();

        let timeCounter = this.timeCounters[key];
        if (timeCounter)
        {
            let diff = time - timeCounter;
            let label = name + ": " + diff + "ms";

            this.info(label);

            delete this.timeCounters[key];
        }
        return diff;
    };

    // These functions are over-ridden by commandLine
    this.evaluated = function(result, context)
    {
        if (FBTrace.DBG_CONSOLE)
            FBTrace.sysout("consoleInjector.FirebugConsoleHandler evalutated default called", result);

        Firebug.Console.log(result, context);
    };
    this.evaluateError = function(result, context)
    {
        Firebug.Console.log(result, context, "errorMessage");
    };

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    function logFormatted(args, className, linkToSource, noThrottle)
    {
        let sourceLink = linkToSource ? getStackLink() : null;
        return Firebug.Console.logFormatted(args, context, className, noThrottle, sourceLink);
    }

    function logAssert(category, args)
    {
        Firebug.Errors.increaseCount(context);

        let msg;

        if (!args || !args.length || args.length == 0)
            msg = [FBL.$STR("Assertion")];
        else
            msg = args[0];

        if (Firebug.errorStackTrace)
        {
            let trace = Firebug.errorStackTrace;
            delete Firebug.errorStackTrace;
            if (FBTrace.DBG_CONSOLE)
                FBTrace.sysout("logAssert trace from errorStackTrace", trace);
        }
        else if (msg.stack)
        {
            let trace = parseToStackTrace(msg.stack);
            if (FBTrace.DBG_CONSOLE)
                FBTrace.sysout("logAssert trace from msg.stack", trace);
        }
        else
        {
            let trace = getJSDUserStack();
            if (FBTrace.DBG_CONSOLE)
                FBTrace.sysout("logAssert trace from getJSDUserStack", trace);
        }

        let errorObject = new FBL.ErrorMessage(msg, (msg.fileName?msg.fileName:win.location), (msg.lineNumber?msg.lineNumber:0), "", category, context, trace);


        if (trace && trace.frames && trace.frames[0])
           errorObject.correctWithStackTrace(trace);

        errorObject.resetSource();

        let objects = errorObject;
        if (args.length > 1)
        {
            objects = [errorObject];
            for (let i = 1; i < args.length; i++)
                objects.push(args[i]);
        }

        let row = Firebug.Console.log(objects, context, "errorMessage", null, true); // noThrottle
        row.scrollIntoView();
    }

    function getComponentsStackDump()
    {
        // Starting with our stack, walk back to the user-level code
        let frame = Components.stack;
        let userURL = win.location.href.toString();

        if (FBTrace.DBG_CONSOLE)
            FBTrace.sysout("consoleInjector.getComponentsStackDump initial stack for userURL "+userURL, frame);

        // Drop frames until we get into user code.
        while (frame && FBL.isSystemURL(frame.filename) )
            frame = frame.caller;

        // Drop two more frames, the injected console function and firebugAppendConsole()
        if (frame)
            frame = frame.caller;
        if (frame)
            frame = frame.caller;

        if (FBTrace.DBG_CONSOLE)
            FBTrace.sysout("consoleInjector.getComponentsStackDump final stack for userURL "+userURL, frame);

        return frame;
    }

    function getStackLink()
    {
        // TODO: xxxpedro console2
        return;
        //return FBL.getFrameSourceLink(getComponentsStackDump());
    }

    function getJSDUserStack()
    {
        let trace = FBL.getCurrentStackTrace(context);

        let frames = trace ? trace.frames : null;
        if (frames && (frames.length > 0) )
        {
            let oldest = frames.length - 1;  // 6 - 1 = 5
            for (let i = 0; i < frames.length; i++)
            {
                if (frames[oldest - i].href.indexOf("chrome:") == 0) break;
                let fn = frames[oldest - i].fn + "";
                if (fn && (fn.indexOf("_firebugEvalEvent") != -1) ) break;  // command line
            }
            FBTrace.sysout("consoleInjector getJSDUserStack: "+frames.length+" oldest: "+oldest+" i: "+i+" i - oldest + 2: "+(i - oldest + 2), trace);
            trace.frames = trace.frames.slice(2 - i);  // take the oldest frames, leave 2 behind they are injection code

            return trace;
        }
        else
            return "Firebug failed to get stack trace with any frames";
    }
}

// ************************************************************************************************
// Register console namespace

FBL.registerConsole = function()
{
    //TODO: xxxpedro console options override
    //if (Env.Options.overrideConsole)
    let win = Env.browser.window;
    Firebug.Console.injector.install(win);
};

registerConsole();

}});
