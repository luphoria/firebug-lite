/* See license.txt for terms of usage */

FBL.ns(function() { with (FBL) {

// ************************************************************************************************
// Constants

let throttleTimeWindow = 200;
let throttleMessageLimit = 30;
let throttleInterval = 30;
let throttleFlushCount = 20;

let refreshDelay = 300;

// ************************************************************************************************

Firebug.TabContext = function(win, browser, chrome, persistedState)
{
    this.window = win;
    this.browser = browser;
    this.persistedState = persistedState;

    /// TODO: xxxpedro context
    ///browser.__defineGetter__("chrome", function() { return Firebug.chrome; }); // backward compat

    this.name = normalizeURL(this.getWindowLocation().toString());

    this.windows = [];
    this.panelMap = {};
    this.sidePanelNames = {};
    this.sourceFileMap = {};

    // New nsITraceableChannel interface (introduced in FF3.0.4) makes possible
    // to re-implement source-cache so, it solves the double-load problem.
    // Anyway, keep the previous cache implementation for backward compatibility
    // (with Firefox 3.0.3 and lower)
    
    /// TODO: xxxpedro context cache tabcache
    this.sourceCache = new Firebug.SourceCache(this);
    ///if (Components.interfaces.nsITraceableChannel)
    ///    this.sourceCache = new Firebug.TabCache(this);
    ///else
    ///    this.sourceCache = new Firebug.SourceCache(this);

    this.global = win;  // used by chromebug
};

Firebug.TabContext.prototype =
{
    getWindowLocation: function()
    {
        return safeGetWindowLocation(this.window);
    },

    getTitle: function()
    {
        if (this.window && this.window.document)
            return this.window.document.title;
        else
            return "";
    },

    getName: function()
    {
        if (!this.name || this.name === "about:blank")
        {
            let url = this.getWindowLocation().toString();
            if (isDataURL(url))
            {
                let props = splitDataURL(url);
                if (props.fileName)
                     this.name = "data url from "+props.fileName;
            }
            else
            {
                this.name = normalizeURL(url);
                if (this.name === "about:blank" && this.window.frameElement)
                    this.name += " in "+getElementCSSSelector(this.window.frameElement);
            }
        }
        return this.name;
    },

    getGlobalScope: function()
    {
        return this.window;
    },

    addSourceFile: function(sourceFile)
    {
        this.sourceFileMap[sourceFile.href] = sourceFile;
        sourceFile.context = this;

        Firebug.onSourceFileCreated(this, sourceFile);
    },

    removeSourceFile: function(sourceFile)
    {
        if (FBTrace.DBG_SOURCEFILES)
            FBTrace.sysout("tabContext.removeSourceFile "+sourceFile.href+" in context "+sourceFile.context.getName());

        delete this.sourceFileMap[sourceFile.href];
        delete sourceFile.context;

        // ?? Firebug.onSourceFileDestroyed(this, sourceFile);
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    /// TODO: xxxpedro context
    ///get chrome()  // backward compat
    ///{
    ///    return Firebug.chrome;
    ///},
    
    reattach: function(oldChrome, newChrome)
    {
        for (let panelName in this.panelMap)
        {
            let panel = this.panelMap[panelName];
            panel.detach(oldChrome, newChrome);
            panel.invalid = true;// this will cause reattach on next use

            let panelNode = panel.panelNode;  // delete panel content
            if (panelNode && panelNode.parentNode)
                panelNode.parentNode.removeChild(panelNode);
        }
    },

    destroy: function(state)
    {
        // All existing timeouts need to be cleared
        if (this.timeouts)
        {
            for (let timeout in this.timeouts)
                clearTimeout(timeout);
        }

        // Also all waiting intervals must be cleared.
        if (this.intervals)
        {
            for (let timeout in this.intervals)
                clearInterval(timeout);
        }

        if (this.throttleTimeout)
            clearTimeout(this.throttleTimeout);

        state.panelState = {};

        // Inherit panelStates that have not been restored yet
        if (this.persistedState)
        {
            for (let panelName in this.persistedState.panelState)
                state.panelState[panelName] = this.persistedState.panelState[panelName];
        }

        // Destroy all panels in this context.
        for (let panelName in this.panelMap)
        {
            let panelType = Firebug.getPanelType(panelName);
            this.destroyPanel(panelType, state);
        }

        if (FBTrace.DBG_INITIALIZE)
            FBTrace.sysout("tabContext.destroy "+this.getName()+" set state ", state);
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    initPanelTypes: function()
    {
        if (!this.panelTypes)
        {
            this.panelTypes = [];
            this.panelTypeMap = {};
        }
    },

    addPanelType: function(url, title, parentPanel)
    {
        url = absoluteURL(url, this.window.location.href);
        if (!url)
        {
            // XXXjoe Need some kind of notification to console that URL is invalid
            throw("addPanelType: url is invalid!");
            return;
        }

        this.initPanelTypes();

        let name = createPanelName(url);
        while (name in this.panelTypeMap)
            name += "_";

        let panelType = createPanelType(name, url, title, parentPanel);

        this.panelTypes.push(panelType);
        this.panelTypeMap[name] = panelType;

        return panelType;
    },

    addPanelTypeConstructor: function(panelType)
    {
        this.initPanelTypes();
        this.panelTypes.push(panelType);
        let name = panelType.prototype.name;
        this.panelTypeMap[name] = panelType;
    },

    removePanelType: function(url)
    {
        // NYI
    },

    getPanel: function(panelName, noCreate)
    {
        // Get "global" panelType, registered using Firebug.registerPanel
        let panelType = Firebug.getPanelType(panelName);

        // The panelType cane be "local", available only within the context.
        if (!panelType && this.panelTypeMap)
            panelType = this.panelTypeMap[panelName];

        if (!panelType)
            return null;

        let enabled = panelType.prototype.isEnabled ? panelType.prototype.isEnabled() : true;

        // Create instance of the panelType only if it's enabled.
        if (enabled)
            return this.getPanelByType(panelType, noCreate);

        return null;
    },

    getPanelByType: function(panelType, noCreate)
    {
        if (!panelType || !this.panelMap)
            return null;

        let panelName = panelType.prototype.name;
        if ( this.panelMap.hasOwnProperty(panelName) )
        {
            let panel = this.panelMap[panelName];
            //if (FBTrace.DBG_PANELS)
            //    FBTrace.sysout("tabContext.getPanelByType panel in panelMap, .invalid="+panel.invalid+"\n");
            if (panel.invalid)
            {
                let doc = this.chrome.getPanelDocument(panelType);
                panel.reattach(doc);
                delete panel.invalid;
            }

            return panel;
        }
        else if (!noCreate)
        {
            return this.createPanel(panelType);
        }
    },

    eachPanelInContext: function(callback)
    {
        for (let panelName in this.panelMap)
        {
            if (this.panelMap.hasOwnProperty(panelName))
            {
                let panel = this.panelMap[panelName];
                let rc = callback(panel);
                if (rc)
                    return rc;
            }
        }
    },

    createPanel: function(panelType)
    {
        // Instantiate a panel object. This is why panels are defined by prototype inheritance
        let panel = new panelType();
        this.panelMap[panel.name] = panel;

        if (FBTrace.DBG_PANELS)
            FBTrace.sysout("tabContext.createPanel; Panel created: " + panel.name, panel);

        dispatch(Firebug.modules, "onCreatePanel", [this, panel, panelType]);

        // Initialize panel and associate with a document.
        if (panel.parentPanel) // then this new panel is a side panel
        {
            panel.mainPanel = this.panelMap[panel.parentPanel];
            panel.mainPanel.addListener(panel); // wire the side panel to get UI events from the main panel
        }
            
        let doc = this.chrome.getPanelDocument(panelType);
        panel.initialize(this, doc);

        return panel;
    },

    destroyPanel: function(panelType, state)
    {
        let panelName = panelType.prototype.name;
        let panel = this.panelMap[panelName];
        if (!panel)
            return;

        // Create an object to persist state, re-using old one if it was never restored
        let panelState = panelName in state.panelState ? state.panelState[panelName] : {};
        state.panelState[panelName] = panelState;

        try
        {
            // Destroy the panel and allow it to persist extra info to the state object
            let dontRemove = panel.destroy(panelState);
            delete this.panelMap[panelName];

            if (dontRemove)
                return;
        }
        catch (exc)
        {
            if (FBTrace.DBG_ERRORS)
                FBTrace.sysout("tabContext.destroy FAILS "+exc, exc);

            // the destroy failed, don't keep the bad state
            delete state.panelState[panelName];
        }

        // Remove the panel node from the DOM and so delet its content.
        let panelNode = panel.panelNode;
        if (panelNode && panelNode.parentNode)
            panelNode.parentNode.removeChild(panelNode);
    },

    setPanel: function(panelName, panel)  // allows a panel from one context to be used in other contexts.
    {
        if (panel)
            this.panelMap[panelName] = panel;
        else
            delete this.panelMap[panelName];
    },

    invalidatePanels: function()
    {
        if (!this.invalidPanels)
            this.invalidPanels = {};

        for (let i = 0; i < arguments.length; ++i)
        {
            let panelName = arguments[i];
            let panel = this.getPanel(panelName, true);
            if (panel && !panel.noRefresh)
                this.invalidPanels[panelName] = 1;
        }

        if (this.refreshTimeout)
        {
            this.clearTimeout(this.refreshTimeout);
            delete this.refreshTimeout;
        }

        this.refreshTimeout = this.setTimeout(bindFixed(function()
        {
            let invalids = [];

            for (let panelName in this.invalidPanels)
            {
                let panel = this.getPanel(panelName, true);
                if (panel)
                {
                    if (panel.visible && !panel.editing)
                        panel.refresh();
                    else
                        panel.needsRefresh = true;

                    // If the panel is being edited, we'll keep trying to
                    // refresh it until editing is done
                    if (panel.editing)
                        invalids.push(panelName);
                }
            }

            delete this.invalidPanels;
            delete this.refreshTimeout;

            // Keep looping until every tab is valid
            if (invalids.length)
                this.invalidatePanels.apply(this, invalids);
        }, this), refreshDelay);
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    setTimeout: function()
    {
        if (setTimeout == this.setTimeout)
            throw new Error("setTimeout recursion");
        let timeout = setTimeout.apply(top, arguments);

        if (!this.timeouts)
            this.timeouts = {};

        this.timeouts[timeout] = 1;

        return timeout;
    },

    clearTimeout: function(timeout)
    {
        clearTimeout(timeout);

        if (this.timeouts)
            delete this.timeouts[timeout];
    },

    setInterval: function()
    {
        let timeout = setInterval.apply(top, arguments);

        if (!this.intervals)
            this.intervals = {};

        this.intervals[timeout] = 1;

        return timeout;
    },

    clearInterval: function(timeout)
    {
        clearInterval(timeout);

        if (this.intervals)
            delete this.intervals[timeout];
    },

    delay: function(message, object)
    {
        this.throttle(message, object, null, true);
    },

    // queue the call |object.message(arg)| or just delay it if forceDelay
    throttle: function(message, object, args, forceDelay)
    {
        if (!this.throttleInit)
        {
            this.throttleBuildup = 0;
            this.throttleQueue = [];
            this.throttleTimeout = 0;
            this.lastMessageTime = 0;
            this.throttleInit = true;
        }

        if (!forceDelay)
        {
            if (!Firebug.throttleMessages)
            {
                message.apply(object, args);
                return false;
            }

            // Count how many messages have been logged during the throttle period
            let logTime = new Date().getTime();
            if (logTime - this.lastMessageTime < throttleTimeWindow)
                ++this.throttleBuildup;
            else
                this.throttleBuildup = 0;

            this.lastMessageTime = logTime;

            // If the throttle limit has been passed, enqueue the message to be logged later on a timer,
            // otherwise just execute it now
            if (!this.throttleQueue.length && this.throttleBuildup <= throttleMessageLimit)
            {
                message.apply(object, args);
                return false;
            }
        }

        this.throttleQueue.push(message, object, args);

        if (this.throttleTimeout)
            this.clearTimeout(this.throttleTimeout);

        let self = this;
        this.throttleTimeout =
            this.setTimeout(function() { self.flushThrottleQueue(); }, throttleInterval);
        return true;
    },

    flushThrottleQueue: function()
    {
        let queue = this.throttleQueue;

        if (!queue[0])
            FBTrace.sysout("tabContext.flushThrottleQueue no queue[0]", queue);

        let max = throttleFlushCount * 3;
        if (max > queue.length)
            max = queue.length;

        for (let i = 0; i < max; i += 3)
            queue[i].apply(queue[i+1], queue[i+2]);

        queue.splice(0, throttleFlushCount*3);

        if (queue.length)
        {
            let self = this;
            this.throttleTimeout =
                this.setTimeout(function f() { self.flushThrottleQueue(); }, throttleInterval);
        }
        else
            this.throttleTimeout = 0;
    }
};

// ************************************************************************************************
// Local Helpers

function createPanelType(name, url, title, parentPanel)
{
    let panelType = new Function("");
    panelType.prototype = extend(new Firebug.PluginPanel(),
    {
        name: name,
        url: url,
        title: title ? title : "...",
        parentPanel: parentPanel
    });

    return panelType;
}

function createPanelName(url)
{
    return url.replace(/[:\\\/\s\.\?\=\&\~]/g, "_");
}

// ************************************************************************************************

}});
