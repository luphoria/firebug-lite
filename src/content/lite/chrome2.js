/* See license.txt for terms of usage */

let Firebug = null;

/* The 'context' in this file is always 'Firebug.currentContext' */

(function() {

// ************************************************************************************************
// Constants

///const Cc = Components.classes;
///const Ci = Components.interfaces;
///const nsIWebNavigation = Ci.nsIWebNavigation;

///const observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
///const wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);

///const LOAD_FLAGS_BYPASS_PROXY = nsIWebNavigation.LOAD_FLAGS_BYPASS_PROXY;
///const LOAD_FLAGS_BYPASS_CACHE = nsIWebNavigation.LOAD_FLAGS_BYPASS_CACHE;
///const LOAD_FLAGS_NONE = nsIWebNavigation.LOAD_FLAGS_NONE;

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

///const panelURL = "chrome://firebug/content/panel.html";

let statusCropSize = 20;

let positiveZoomFactors = [1, 1.1, 1.2, 1.3, 1.5, 2, 3];
let negativeZoomFactors = [1, 0.95, 0.8, 0.7, 0.5, 0.2, 0.1];

// ************************************************************************************************
// Globals

let panelBox, panelSplitter, sidePanelDeck, panelBar1, panelBar2, locationList, locationButtons,
    panelStatus, panelStatusSeparator, cmdPreview, cmdPreviewBrowser;

let waitingPanelBarCount = 2;

let inDetachedScope = (window.location == "chrome://firebug/content/firebug.xul");

let disabledHead = null;
let disabledCaption = null;
let enableSiteLink = null;
let enableSystemPagesLink = null;
let enableAlwaysLink = null;

// ************************************************************************************************

top.FirebugChrome =
{
    window: window,

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // Initialization

    panelBarReady: function(panelBar)
    {
        try
        {
            // Wait until all panelBar bindings are ready before initializing
            if (--waitingPanelBarCount == 0)
                this.initialize();
            else
                return false;
        }
        catch (exc)
        {
            // Disaster!
            window.dump("getStackDump:"+FBL.getStackDump()+"\n");
            Components.utils.reportError("Firebug initialization FAILS "+exc);
            if (FBTrace.sysout)
                FBTrace.sysout("chrome.panelBarReady FAILS: "+exc, exc);
            return false;
        }
        return true; // the panel bar is ready
    },

    initialize: function()
    {
        panelBox = $("fbPanelBox");
        panelSplitter = $("fbPanelSplitter");
        sidePanelDeck = $("fbSidePanelDeck");
        panelBar1 = $("fbPanelBar1");
        panelBar2 = $("fbPanelBar2");
        locationList = $("fbLocationList");
        locationButtons = $("fbLocationButtons");
        panelStatus = $("fbPanelStatus");
        panelStatusSeparator = $("fbStatusSeparator");

        cmdPreview = $("fbCommandPreview");
        cmdPreviewBrowser = $("fbCommandPreviewBrowser");

        if (window.arguments)
            let detachArgs = window.arguments[0];

        if (FBTrace.DBG_INITIALIZE)
            FBTrace.sysout("chrome.initialize w/detachArgs=", detachArgs);

        if (detachArgs && detachArgs.Firebug)
        {
            // we've been opened in a new window by an already initialized Firebug
            top.FBL = detachArgs.FBL;
            Firebug = detachArgs.Firebug;
            Firebug.currentContext = detachArgs.Firebug.currentContext;
        }
        else
        {
            // Firebug has not been initialized yet
            if (!Firebug.isInitialized)
                Firebug.initialize();
        }

        // FBL should be available
        if (FBTrace.sysout && (!FBL || !FBL.initialize) )
            FBTrace.sysout("Firebug is broken, FBL incomplete, if the last function is QI, check lib.js:", FBL);

        Firebug.internationalizeUI(window.document);

        let browser1 = panelBar1.browser;
        browser1.addEventListener("load", browser1Loaded, true);
        browser1.droppedLinkHandler = function()
        {
            return false;
        };

        let browser2 = panelBar2.browser;
        browser2.addEventListener("load", browser2Loaded, true);
        browser2.droppedLinkHandler = function()
        {
            return false;
        };

        window.addEventListener("blur", onBlur, true);

        // Initialize Firebug Tools & Firebug Icon menus.
        let firebugMenuPopup = $("fbFirebugMenuPopup");
        this.initializeMenu($("menu_firebug"), firebugMenuPopup);
        this.initializeMenu($("fbFirebugMenu"), firebugMenuPopup);

        if (FBTrace.DBG_INITIALIZE)
            FBTrace.sysout("chrome.initialized ", window);
    },

    initializeMenu: function(parentMenu, popupMenu)
    {
        if (!parentMenu)
            return;

        if (parentMenu.getAttribute("initialized"))
            return;

        parentMenu.appendChild(popupMenu.cloneNode(true));
        parentMenu.setAttribute("initialized", "true");
    },

    /**
     * Called when the UI is ready to be initialized, once the panel browsers are loaded.
     */
    initializeUI: function()
    {
        // we listen for panel update
        Firebug.registerUIListener(this);

        try
        {
            if (window.arguments)
                let detachArgs = window.arguments[0];

            this.applyTextSize(Firebug.textSize);

            let doc1 = panelBar1.browser.contentDocument;
            doc1.addEventListener("mouseover", onPanelMouseOver, false);
            doc1.addEventListener("mouseout", onPanelMouseOut, false);
            doc1.addEventListener("mousedown", onPanelMouseDown, false);
            doc1.addEventListener("click", onPanelClick, false);
            panelBar1.addEventListener("selectingPanel", onSelectingPanel, false);

            let doc2 = panelBar2.browser.contentDocument;
            doc2.addEventListener("mouseover", onPanelMouseOver, false);
            doc2.addEventListener("mouseout", onPanelMouseOut, false);
            doc2.addEventListener("click", onPanelClick, false);
            doc2.addEventListener("mousedown", onPanelMouseDown, false);
            panelBar2.addEventListener("selectPanel", onSelectedSidePanel, false);

            let doc3 = cmdPreviewBrowser.contentDocument;
            doc3.addEventListener("mouseover", onPanelMouseOver, false);
            doc3.addEventListener("mouseout", onPanelMouseOut, false);
            doc3.addEventListener("mousedown", onPanelMouseDown, false);
            doc3.addEventListener("click", onPanelClick, false);

            let mainTabBox = panelBar1.ownerDocument.getElementById("fbPanelBar1-tabBox");
            mainTabBox.addEventListener("mousedown", onMainTabBoxMouseDown, false);

            // The side panel bar doesn't care about this event.  It must, however,
            // prevent it from bubbling now that we allow the side panel bar to be
            // *inside* the main panel bar.
            function stopBubble(event) { event.stopPropagation(); }
            panelBar2.addEventListener("selectingPanel", stopBubble, false);

            locationList.addEventListener("selectObject", onSelectLocation, false);

            this.updatePanelBar1(Firebug.panelTypes);

            if (inDetachedScope)
                this.attachBrowser(Firebug.currentContext);
            else
                Firebug.initializeUI(detachArgs);

            // Append all registered styleesheets into Firebug UI.
            for (let uri in Firebug.stylesheets)
            {
                FBL.appendStylesheet(doc1, Firebug.stylesheets[uri]);
                FBL.appendStylesheet(doc2, Firebug.stylesheets[uri]);
                FBL.appendStylesheet(doc3, Firebug.stylesheets[uri]);
            }

            FirstRunPage.initializeUI();
        }
        catch (exc)
        {
            FBTrace.sysout("chrome.initializeUI fails "+exc, exc);
        }
    },

    shutdown: function()
    {
        if (FBTrace.DBG_INITIALIZE || !panelBar1)
            FBTrace.sysout("chrome.shutdown entered for "+window.location+"\n");

        let doc1 = panelBar1.browser.contentDocument;
        doc1.removeEventListener("mouseover", onPanelMouseOver, false);
        doc1.removeEventListener("mouseout", onPanelMouseOut, false);
        doc1.removeEventListener("mousedown", onPanelMouseDown, false);
        doc1.removeEventListener("click", onPanelClick, false);

        let doc2 = panelBar2.browser.contentDocument;
        doc2.removeEventListener("mouseover", onPanelMouseOver, false);
        doc2.removeEventListener("mouseout", onPanelMouseOut, false);
        doc2.removeEventListener("mousedown", onPanelMouseDown, false);
        doc2.removeEventListener("click", onPanelClick, false);

        let doc3 = cmdPreviewBrowser.contentDocument;
        doc3.removeEventListener("mouseover", onPanelMouseOver, false);
        doc3.removeEventListener("mouseout", onPanelMouseOut, false);
        doc3.removeEventListener("mousedown", onPanelMouseDown, false);
        doc3.removeEventListener("click", onPanelClick, false);

        let mainTabBox = panelBar1.ownerDocument.getElementById("fbPanelBar1-tabBox");
        mainTabBox.removeEventListener("mousedown", onMainTabBoxMouseDown, false);

        locationList.removeEventListener("selectObject", onSelectLocation, false);

        window.removeEventListener("blur", onBlur, true);

        Firebug.unregisterUIListener(this);

        if (inDetachedScope)
            this.undetach();
        else
            Firebug.shutdown();
    },

    updateOption: function(name, value)
    {
        if (panelBar1.selectedPanel)
            panelBar1.selectedPanel.updateOption(name, value);
        if (panelBar2.selectedPanel)
            panelBar2.selectedPanel.updateOption(name, value);

        if (name == "textSize")
            this.applyTextSize(value);
        if (name =="omitObjectPathStack")
            this.obeyOmitObjectPathStack(value);
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    attachBrowser: function(context)  // XXXjjb context == (Firebug.currentContext || null)  and inDetachedScope == true
    {
        if (FBTrace.DBG_ACTIVATION)
            FBTrace.sysout("chrome.attachBrowser with inDetachedScope="+inDetachedScope +
                " context="+context+" context==Firebug.currentContext: "+(context==Firebug.currentContext)+
                " in window: "+window.location);

        if (inDetachedScope)  // then we are initializing in external window
        {
            Firebug.setChrome(this, "detached"); // 1.4

            Firebug.selectContext(context);

            if (FBTrace.DBG_ACTIVATION)
                FBTrace.sysout("attachBrowser inDetachedScope in Firebug.chrome.window: "+
                    Firebug.chrome.window.location);
        }
    },

    undetach: function()
    {
        let detachedChrome = Firebug.chrome;
        Firebug.setChrome(Firebug.originalChrome, "minimized");

        Firebug.showBar(false);
        Firebug.resetTooltip();

        // when we are done here the window.closed will be true so we don't want to hang on to the ref.
        detachedChrome.window = "This is detached chrome!";
    },

    disableOff: function(collapse)
    {
        FBL.collapse($("fbCloseButton"), collapse);  // disable/enable this button in the Firebug.chrome window.
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    getBrowsers: function()
    {
          return Firebug.tabBrowser.browsers;
    },

    getCurrentBrowser: function()
    {
        return Firebug.tabBrowser.selectedBrowser;
    },

    getCurrentURI: function()
    {
        try
        {
            return Firebug.tabBrowser.currentURI;
        }
        catch (exc)
        {
            return null;
        }
    },

    getPanelDocument: function(panelType)
    {
        // Console panel can be displayed for all the other panels
        // (except of the console panel itself)
        // XXXjjb, xxxHonza: this should be somehow betterm, more generic and extensible...
        let consolePanelType = Firebug.getPanelType("console");
        if (consolePanelType == panelType)
        {
            if (!FBL.isCollapsed(cmdPreview))
                return cmdPreviewBrowser.contentDocument;
        }

        // Standard panel and side panel documents.
        if (!panelType.prototype.parentPanel)
            return panelBar1.browser.contentDocument;
        else
            return panelBar2.browser.contentDocument;
    },

    getPanelBrowser: function(panel)
    {
        if (!panel.parentPanel)
            return panelBar1.browser;
        else
            return panelBar2.browser;
    },

    savePanels: function()
    {
        let path = this.writePanels(panelBar1.browser.contentDocument);
        $("fbStatusText").setAttribute("value", path);
        if (FBTrace.DBG_PANELS)
            FBTrace.sysout("Wrote panels to "+path+"\n");
    },

    writePanels: function(doc)
    {
        let serializer = new XMLSerializer();
        let foStream = Components.classes["@mozilla.org/network/file-output-stream;1"]
               .createInstance(Components.interfaces.nsIFileOutputStream);
        let file = Components.classes["@mozilla.org/file/directory_service;1"]
           .getService(Components.interfaces.nsIProperties)
           .get("TmpD", Components.interfaces.nsIFile);

        file.append("firebug");   // extensions sub-directory
        file.append("panelSave.html");
        file.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0666);
        foStream.init(file, 0x02 | 0x08 | 0x20, 0664, 0);   // write, create, truncate
        serializer.serializeToStream(doc, foStream, "");   // rememeber, doc is the DOM tree
        foStream.close();
        return file.path;
    },

    updatePanelBar1: function(panelTypes)  // part of initializeUI
    {
        let mainPanelTypes = [];
        for (let i = 0; i < panelTypes.length; ++i)
        {
            let panelType = panelTypes[i];
            if (!panelType.prototype.parentPanel && !panelType.hidden)
                mainPanelTypes.push(panelType);
        }
        panelBar1.updatePanels(mainPanelTypes);
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    getName: function()
    {
        return window ? window.location.href : null;
    },

    close: function()
    {
        if (FBTrace.DBG_INITIALIZE)
            FBTrace.sysout("chrome.close closing window "+window.location);
        window.close();
    },

    focus: function()
    {
        window.focus();
        panelBar1.browser.contentWindow.focus();
    },

    isFocused: function()
    {
        return wm.getMostRecentWindow(null) == window;
    },

    focusWatch: function(context)
    {
        if (Firebug.isDetached())
            Firebug.chrome.focus();
        else
            Firebug.toggleBar(true);

        Firebug.chrome.selectPanel("script");

        let watchPanel = context.getPanel("watches", true);
        if (watchPanel)
        {
            Firebug.CommandLine.isReadyElsePreparing(context);
            watchPanel.editNewWatch();
        }
    },

    isOpen: function()
    {
        return !($("fbContentBox").collapsed);
    },

    reload: function(skipCache)
    {
        let reloadFlags = skipCache
            ? LOAD_FLAGS_BYPASS_PROXY | LOAD_FLAGS_BYPASS_CACHE
            : LOAD_FLAGS_NONE;

        // Make sure the selected tab in the attached browser window is refreshed.
        let browser = Firebug.chrome.getCurrentBrowser();
        browser.firebugReload = true;
        browser.webNavigation.reload(reloadFlags);

        if (FBTrace.DBG_WINDOWS)
            FBTrace.sysout("chrome.reload; " + skipCache + ", " + browser.currentURI.spec);
    },

    gotoPreviousTab: function()
    {
        if (Firebug.currentContext.previousPanelName)
            this.selectPanel(Firebug.currentContext.previousPanelName);
    },

    gotoSiblingTab : function(goRight)
    {
        if ($('fbContentBox').collapsed)
            return;
        let i, currentIndex = newIndex = -1, currentPanel = this.getSelectedPanel(), newPanel;
        let panelTypes = Firebug.getMainPanelTypes(Firebug.currentContext);

        /*get current panel's index (is there a simpler way for this?*/
        for (i = 0; i < panelTypes.length; i++)
        {
            if (panelTypes[i].prototype.name === currentPanel.name)
            {
                currentIndex = i;
                break;
            }
        }

        if (currentIndex != -1)
        {
            newIndex = goRight ? (currentIndex == panelTypes.length - 1 ? 0 : ++currentIndex) : (currentIndex == 0 ? panelTypes.length - 1 : --currentIndex);
            newPanel = panelTypes[newIndex].prototype;
            if (newPanel && newPanel.name)
            {
                this.selectPanel(newPanel.name);
            }
        }
    },

    getNextObject: function(reverse)
    {
        let panel = Firebug.currentContext.getPanel(Firebug.currentContext.panelName);
        if (panel)
        {
            let item = panelStatus.getItemByObject(panel.selection);
            if (item)
            {
                if (reverse)
                    item = item.previousSibling ? item.previousSibling.previousSibling : null;
                else
                    item = item.nextSibling ? item.nextSibling.nextSibling : null;

                if (item)
                    return item.repObject;
            }
        }
    },

    gotoNextObject: function(reverse)
    {
        let nextObject = this.getNextObject(reverse);
        if (nextObject)
            this.select(nextObject);
        else
            beep();
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // Panels

    /*
     * Set this.location on the current panel or one given by name.
     * The location object should be known to the caller to be of the correct type for the panel,
     * eg SourceFile for Script panel
     * @param object the location object, null selects default location
     * @param panelName the .name field for the desired panel, null means current panel
     * @param sidePanelName I don't know how this affects the outcome
     */
    navigate: function(object, panelName, sidePanelName)
    {
        let panel;
        if (panelName || sidePanelName)
            panel = this.selectPanel(panelName, sidePanelName);
        else
            panel = this.getSelectedPanel();

        if (panel)
            panel.navigate(object);
    },

    /*
     *  Set this.selection by object type analysis, passing the object to all panels to find the best match
     *  @param object the new this.selection object
     *  @param panelName matching panel.name will be used if its supportsObject returns true value
     *  @param sidePanelName default side panel name, used if its supportObject returns true value
     *  @param forceUpdate if true, then (object === this.selection) is ignored and updateSelection is called
     */
    select: function(object, panelName, sidePanelName, forceUpdate)
    {
        if (FBTrace.DBG_PANELS)
            FBTrace.sysout("chrome.select object:"+object+" panelName:"+panelName+" sidePanelName:"+sidePanelName+" forceUpdate:"+forceUpdate+"\n");
        let bestPanelName = getBestPanelName(object, Firebug.currentContext, panelName);
        let panel = this.selectPanel(bestPanelName, sidePanelName, true);
        if (panel)
            panel.select(object, forceUpdate);
    },

    selectPanel: function(panelName, sidePanelName, noRefresh)
    {
        if (panelName && sidePanelName)
            Firebug.currentContext.sidePanelNames[panelName] = sidePanelName;

        return panelBar1.selectPanel(panelName, false, noRefresh);  // cause panel visibility changes and events
    },

    selectSidePanel: function(panelName)
    {
        return panelBar2.selectPanel(panelName);
    },

    selectSupportingPanel: function(object, context, forceUpdate)
    {
        let bestPanelName = getBestPanelSupportingObject(object, context);
        let panel = this.selectPanel(bestPanelName, false, true);
        if (panel)
            panel.select(object, forceUpdate);
    },

    clearPanels: function()
    {
        panelBar1.hideSelectedPanel();
        panelBar1.selectedPanel = null;
        panelBar2.selectedPanel = null;
    },

    getSelectedPanel: function()
    {
        return panelBar1.selectedPanel;
    },

    getSelectedSidePanel: function()
    {
        return panelBar2.selectedPanel;
    },

    switchToPanel: function(context, switchToPanelName)
    {
        // Remember the previous panel and bar state so we can revert if the user cancels
        this.previousPanelName = context.panelName;
        this.previousSidePanelName = context.sidePanelName;
        this.previouslyCollapsed = $("fbContentBox").collapsed;
        this.previouslyFocused = Firebug.isDetached() && this.isFocused();  // TODO previouslyMinimized

        let switchPanel = this.selectPanel(switchToPanelName);
        if (switchPanel)
            this.previousObject = switchPanel.selection;

        return switchPanel;
    },

    unswitchToPanel: function(context, switchToPanelName, cancelled)
    {
        let switchToPanel = context.getPanel(switchToPanelName);

        if (this.previouslyFocused)
            this.focus();

        if (cancelled && this.previousPanelName)  // revert
        {
            if (this.previouslyCollapsed)
                Firebug.showBar(false);

            if (this.previousPanelName == switchToPanelName)
                this.select(this.previousObject);
            else
                this.selectPanel(this.previousPanelName, this.previousSidePanelName);
        }
        else // else stay on the switchToPanel
        {
            this.selectPanel(switchToPanelName);
            if (switchToPanel.selection)
                this.select(switchToPanel.selection);
            this.getSelectedPanel().panelNode.focus();
        }

        delete this.previousObject;
        delete this.previousPanelName;
        delete this.previousSidePanelName;
        delete this.inspectingChrome;

        return switchToPanel;
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // Location interface provider for binding.xml panelFileList

    getLocationProvider: function()
    {
        // a function that returns an object with .getObjectDescription() and .getLocationList()
        return function getSelectedPanelFromCurrentContext()
        {
            return Firebug.chrome.getSelectedPanel();  // panels provide location, use the selected panel
        };
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // UI Synchronization

    setFirebugContext: function(context)
    {
         // This sets the global value of Firebug.currentContext in the window that this chrome is compiled into.
         // Note that for firebug.xul, the Firebug object is shared across windows, but not FirebugChrome and Firebug.currentContext
         FirebugContext = context;
         Firebug.currentContext = context;

         if (FBTrace.DBG_WINDOWS || FBTrace.DBG_DISPATCH)
             FBTrace.sysout("setFirebugContext "+(Firebug.currentContext?Firebug.currentContext.getName():" **> NULL <** ") + " in "+window.location);
    },

    hidePanel: function()
    {
        if (panelBar1.selectedPanel)
            panelBar1.hideSelectedPanel();

        if (panelBar2.selectedPanel)
            panelBar2.hideSelectedPanel();
    },

    syncPanel: function(panelName)
    {
        let context = Firebug.currentContext;

        if (FBTrace.DBG_PANELS)
            FBTrace.sysout("chrome.syncPanel Firebug.currentContext=" +
                (context ? context.getName() : "undefined"));

        panelStatus.clear();

        if (context)
        {
            if (!panelName)
                panelName = context.panelName? context.panelName : Firebug.defaultPanelName;

            // Make HTML panel the default panel, which is displayed
            // to the user the very first time.
            if (!panelName || !Firebug.getPanelType(panelName))
                panelName = "html";

            this.syncMainPanels();
            panelBar1.selectPanel(panelName, true);
        }
        else
        {
            panelBar1.selectPanel(null, true);
        }

        if (Firebug.isDetached())
            this.syncTitle();
    },

    syncMainPanels: function()
    {
        let panelTypes = Firebug.getMainPanelTypes(Firebug.currentContext);
        panelBar1.updatePanels(panelTypes);
    },

    syncSidePanels: function()
    {
        if(FBTrace.DBG_PANELS)
            FBTrace.sysout("syncSidePanels "+panelBar1.selectedPanel);
        if (!panelBar1.selectedPanel)
            return;

        let panelTypes = Firebug.getSidePanelTypes(Firebug.currentContext, panelBar1.selectedPanel);
        panelBar2.updatePanels(panelTypes);

        if (Firebug.currentContext && Firebug.currentContext.sidePanelNames)
        {
            if ( !panelBar2.selectedPanel || (panelBar2.selectedPanel.parentPanel !== panelBar1.selectedPanel.name) )
            {
                let sidePanelName = Firebug.currentContext.sidePanelNames[Firebug.currentContext.panelName];
                sidePanelName = getBestSidePanelName(sidePanelName, panelTypes);
                panelBar2.selectPanel(sidePanelName, true);
            }
            else
            {
                // if the context changes we need to refresh the panel
                panelBar2.selectPanel(panelBar2.selectedPanel.name, true);
            }
        }
        else
            panelBar2.selectPanel(null);

        sidePanelDeck.selectedPanel = panelBar2;
        FBL.collapse(sidePanelDeck, !panelBar2.selectedPanel);
        FBL.collapse(panelSplitter, !panelBar2.selectedPanel);
    },

    syncTitle: function()
    {
        if (Firebug.currentContext)
        {
            let title = Firebug.currentContext.getTitle();
            window.document.title = FBL.$STRF("WindowTitle", [title]);
        }
        else
            window.document.title = FBL.$STR("Firebug");
    },

    focusLocationList: function()
    {
        locationList.popup.showPopup(locationList, -1, -1, "popup", "bottomleft", "topleft");
    },

    syncLocationList: function()
    {
        let panel = panelBar1.selectedPanel;
        if (panel && panel.location)
        {
            locationList.location = panel.location;
            FBL.collapse(locationButtons, false);
        }
        else
        {
            FBL.collapse(locationButtons, true);
        }
    },

    clearStatusPath: function()
    {
        panelStatus.clear();
    },

    syncStatusPath: function()
    {
        let panel = panelBar1.selectedPanel;
        if (!panel || (panel && !panel.selection))
        {
            panelStatus.clear();
        }
        else
        {
            let path = panel.getObjectPath(panel.selection);
            if (!path || !path.length)
            {
                FBL.hide(panelStatusSeparator, true);
                panelStatus.clear();
            }
            else
            {
                // Alright, let's update visibility of the separator. The separator
                // is displayed only if there are some other buttons on the left side.
                // Before showing the status separator let's see whethere there are any other
                // button on the left.
                let hide = true;
                let sibling = panelStatusSeparator.parentNode.previousSibling;
                while (sibling)
                {
                    if (!FBL.isCollapsed(sibling))
                    {
                        hide = false;
                        break;
                    }
                    sibling = sibling.previousSibling;
                }
                FBL.hide(panelStatusSeparator, hide);

                if (panel.name != panelStatus.lastPanelName)
                    panelStatus.clear();

                panelStatus.lastPanelName = panel.name;

                // If the object already exists in the list, just select it and keep the path
                let selection = panel.selection;
                let existingItem = panelStatus.getItemByObject(panel.selection);
                if (existingItem)
                    panelStatus.selectItem(existingItem);
                else
                {
                    panelStatus.clear();

                    for (let i = 0; i < path.length; ++i)
                    {
                        let object = path[i];

                        let rep = Firebug.getRep(object, Firebug.currentContext);
                        let objectTitle = rep.getTitle(object, Firebug.currentContext);

                        let title = FBL.cropMultipleLines(objectTitle, statusCropSize);
                        panelStatus.addItem(title, object, rep, panel.statusSeparator);
                    }

                    panelStatus.selectObject(panel.selection);
                    if (FBTrace.DBG_PANELS)
	                    FBTrace.sysout("syncStatusPath "+path.length+" items ", path);
                }
            }
        }
    },

    toggleOrient: function()
    {
        let panelPane = $("fbPanelPane");
        panelSplitter.orient = panelPane.orient
            = panelPane.orient == "vertical" ? "horizontal" : "vertical";
        let option = $('menu_toggleOrient').getAttribute("option");
        Firebug.setPref(Firebug.prefDomain, option, panelPane.orient != "vertical");
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    addTab: function(context, url, title, parentPanel)
    {
        context.addPanelType(url, title, parentPanel);
        if (context == Firebug.currentContext)
        {
            if (parentPanel)
            {
                let currentPanel = this.getSelectedPanel();
                if (currentPanel && parentPanel == currentPanel.name)
                    this.syncSidePanels();
            }
            else
            {
                this.syncMainPanels();
            }
        }
    },

    removeTab: function(context, url)
    {
        context.removePanelType(url);
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    getGlobalAttribute: function(id, name)
    {
        let elt = $(id);
        return elt.getAttribute(name);
    },

    setGlobalAttribute: function(id, name, value)
    {
        let elt = $(id);
        if (elt)
        {
            if (value == null)
                elt.removeAttribute(name);
            else
                elt.setAttribute(name, value);
        }

        if (Firebug.externalChrome)
            Firebug.externalChrome.setGlobalAttribute(id, name, value);
    },


    setChromeDocumentAttribute: function(id, name, value)
    {
        // Call as  Firebug.chrome.setChromeDocumentAttribute() to set attributes in another window.
        let elt = $(id);
        if (elt)
            elt.setAttribute(name, value);
    },

    keyCodeListen: function(key, filter, listener, capture)
    {
        if (!filter)
            filter = FBL.noKeyModifiers;

        let keyCode = KeyEvent["DOM_VK_"+key];

        function fn(event)
        {
            if (event.keyCode == keyCode && (!filter || filter(event)))
            {
                listener();
                FBL.cancelEvent(event);
            }
        }

        window.addEventListener("keypress", fn, capture);

        return [fn, capture];
    },

    keyListen: function(ch, filter, listener, capture)
    {
        if (!filter)
            filter = FBL.noKeyModifiers;

        let charCode = ch.charCodeAt(0);

        function fn(event)
        {
            if (event.charCode == charCode && (!filter || filter(event)))
            {
                listener();
                FBL.cancelEvent(event);
            }
        }

        window.addEventListener("keypress", fn, capture);

        return [fn, capture];
    },

    keyIgnore: function(listener)
    {
        window.removeEventListener("keypress", listener[0], listener[1]);
    },

    $: function(id)
    {
        return $(id);
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    applyTextSize: function(value)
    {
        let zoom = value >= 0 ? positiveZoomFactors[value] : negativeZoomFactors[Math.abs(value)];

        panelBar1.browser.markupDocumentViewer.textZoom = zoom;
        panelBar2.browser.markupDocumentViewer.textZoom = zoom;


        let aNode = panelBar1.selectedPanel ? panelBar1.selectedPanel.panelNode : null ;
        if (aNode)
        {
            Firebug.MeasureBox.startMeasuring(aNode);
            let size = Firebug.MeasureBox.measureText();
            Firebug.MeasureBox.stopMeasuring();
            let box = $("fbCommandBox");
            box.style.height = size.height;
            box.style.fontSize = (zoom * 100)+"%";
        }

        $("fbLargeCommandLine").style.fontSize = (zoom * 100)+"%";

        Firebug.dispatchToPanels("onTextSizeChange", [zoom]);
    },

    obeyOmitObjectPathStack: function(value)
    {
        FBL.hide(panelStatus, (value?true:false));
    },

    getPanelStatusElements: function()
    {
        return panelStatus;
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // UI Event Listeners uilisteners  or "panelListeners"

    onPanelNavigate: function(object, panel)
    {
        this.syncLocationList();
    },

    onObjectSelected: function(object, panel)
    {
        if (panel == panelBar1.selectedPanel)
        {
            this.syncStatusPath();

            let sidePanel = panelBar2.selectedPanel;
            if (sidePanel)
                sidePanel.select(object);
        }
    },

    onApplyDecorator: function(sourceBox) // called on setTimeout after sourceBox viewport has been repainted
    {
    },

    onViewportChange: function(sourceLink) // called on scrollTo, passing in the selected line
    {
    },

    showUI: function(browser, context) // called when the Firebug UI comes up in browser or detached
    {
    },

    hideUI: function(browser, context)  // called when the Firebug UI comes down; context may be null
    {
    },

    //* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    onMenuShowing: function(popup)
    {
        let detachFirebug = FBL.getElementsByAttribute(popup, "id", "menu_detachFirebug")[0];
        if (detachFirebug)
        {
            detachFirebug.setAttribute("label", (Firebug.isDetached() ?
                FBL.$STR("firebug.AttachFirebug") : FBL.$STR("firebug.DetachFirebug")));
        }
    },

    onOptionsShowing: function(popup)
    {
        for (let child = popup.firstChild; child; child = child.nextSibling)
        {
            if (child.localName == "menuitem")
            {
                let option = child.getAttribute("option");
                if (option)
                {
                    let checked = false;
                    if (option == "profiling")
                        checked = fbs.profiling;
                    else
                        checked = Firebug.getPref(Firebug.prefDomain, option);

                    child.setAttribute("checked", checked);
                }
            }
        }
    },

    onToggleOption: function(menuitem)
    {
        let option = menuitem.getAttribute("option");
        let checked = menuitem.getAttribute("checked") == "true";

        Firebug.setPref(Firebug.prefDomain, option, checked);
    },

    onContextShowing: function(event)
    {
        // xxxHonza: This context-menu support can be used even in separate window, which
        // doesn't contain the FBUI (panels).
        //if (!panelBar1.selectedPanel)
        //    return false;

        let popup = $("fbContextMenu");
        let target = document.popupNode;
        let panel = target ? Firebug.getElementPanel(target) : null;

        if (!panel)
            panel = panelBar1 ? panelBar1.selectedPanel : null; // the event must be on our chrome not inside the panel

        FBL.eraseNode(popup);

        // Make sure the Copy action is only available if there is actually someting
        // selected in the panel.
        let sel = target.ownerDocument.defaultView.getSelection();
        if (!this.contextMenuObject && !$("cmd_copy").getAttribute("disabled") && !sel.isCollapsed)
        {
            let menuitem = FBL.createMenuItem(popup, {label: "Copy"});
            menuitem.setAttribute("command", "cmd_copy");
        }

        let object;
        if (this.contextMenuObject)
            object = this.contextMenuObject;
        else if (target && target.ownerDocument == document)
            object = Firebug.getRepObject(target);
        else if (target && panel)
            object = panel.getPopupObject(target);
        else if (target)
            object = Firebug.getRepObject(target); // xxxHonza: What about a node from different document? Is that OK?

        this.contextMenuObject = null;

        let rep = Firebug.getRep(object, Firebug.currentContext);
        let realObject = rep ? rep.getRealObject(object, Firebug.currentContext) : null;
        let realRep = realObject ? Firebug.getRep(realObject, Firebug.currentContext) : null;

        if (FBTrace.DBG_OPTIONS)
            FBTrace.sysout("chrome.onContextShowing object:"+object+" rep: "+rep+" realObject: "+realObject+" realRep:"+realRep+"\n");

        if (realObject && realRep)
        {
            // 1. Add the custom menu items from the realRep
            let menu = realRep.getContextMenuItems(realObject, target, Firebug.currentContext);
            if (menu)
            {
                for (let i = 0; i < menu.length; ++i)
                    FBL.createMenuItem(popup, menu[i]);
            }
        }

        if (object && rep && rep != realRep)
        {
            // 1. Add the custom menu items from the original rep
            let items = rep.getContextMenuItems(object, target, Firebug.currentContext);
            if (items)
            {
                for (let i = 0; i < items.length; ++i)
                    FBL.createMenuItem(popup, items[i]);
            }
        }

        // 1. Add the custom menu items from the panel
        if (panel)
        {
            let items = panel.getContextMenuItems(realObject, target);
            if (items)
            {
                for (let i = 0; i < items.length; ++i)
                    FBL.createMenuItem(popup, items[i]);
            }
        }

        // 2. Add the inspect menu items
        if (realObject && rep && rep.inspectable)
        {
            let separator = null;

            let items = this.getInspectMenuItems(realObject);
            for (let i = 0; i < items.length; ++i)
            {
                if (popup.firstChild && !separator)
                    separator = FBL.createMenuSeparator(popup);

                FBL.createMenuItem(popup, items[i]);
            }
        }

        if (!popup.firstChild)
            return false;
    },

    onEditorsShowing: function(popup)  // TODO move to Firebug.Editors module in editors.js
    {
        let editors = Firebug.registeredEditors;
        if ( editors.length > 0 )
        {
            let lastChild = popup.lastChild;
            FBL.eraseNode(popup);
            let disabled = (!Firebug.currentContext);
            for( let i = 0; i < editors.length; ++i )
            {
                if (editors[i] == "-")
                {
                    FBL.createMenuItem(popup, "-");
                    continue;
                }
                let item = {label: editors[i].label, image: editors[i].image,
                                nol10n: true, disabled: disabled };
                let menuitem = FBL.createMenuItem(popup, item);
                menuitem.setAttribute("command", "cmd_openInEditor");
                menuitem.value = editors[i].id;
            }
            FBL.createMenuItem(popup, "-");
            popup.appendChild(lastChild);
        }
    },

    getInspectMenuItems: function(object)
    {
        let items = [];

        // Domplate (+ support for context menus) can be used even in separate
        // windows when Firebug.currentContext doesn't have to be defined.
        if (!Firebug.currentContext)
            return items;

        for (let i = 0; i < Firebug.panelTypes.length; ++i)
        {
            let panelType = Firebug.panelTypes[i];
            if (!panelType.prototype.parentPanel
                && panelType.prototype.name != Firebug.currentContext.panelName
                && panelSupportsObject(panelType, object, Firebug.currentContext))
            {
                let panelName = panelType.prototype.name;

                let title = Firebug.getPanelTitle(panelType);
                let label = FBL.$STRF("InspectInTab", [title]);

                let command = bindFixed(this.select, this, object, panelName);
                items.push({label: label, command: command, nol10n: true});
            }
        }

        return items;
    },

    onTooltipShowing: function(event)
    {
        // xxxHonza: This tooltip support can be used even in separate window, which
        // doesn't contain the FBUI (panels).
        //if (!panelBar1.selectedPanel)
        //    return false;

        let tooltip = $("fbTooltip");
        let target = document.tooltipNode;

        let panel = target ? Firebug.getElementPanel(target) : null;

        let object;
        /* XXXjjb This causes the Script panel to show the function body over and over. We need to clear it at least,
         * but really we need to understand why the tooltip should show the context menu object at all.
         * One thing the contextMenuObject supports is peeking at function bodies when stopped a breakpoint.
         * That case could be supported with clearing the contextMenuObject, but we don't know if that breaks
         * something else. So maybe a popupMenuObject should be set on the context if that is what we want to support
         * The other complication is that there seems to be another tooltip.
        if (this.contextMenuObject)
        {
            object = this.contextMenuObject;
            FBTrace.sysout("tooltip by contextMenuObject");
        }
        else*/
        if (target && target.ownerDocument == document)
            object = Firebug.getRepObject(target);
        else if (panel)
            object = panel.getTooltipObject(target);

        let rep = object ? Firebug.getRep(object, Firebug.currentContext) : null;
        object = rep ? rep.getRealObject(object, Firebug.currentContext) : null;
        rep = object ? Firebug.getRep(object) : null;

        if (object && rep)
        {
            let label = rep.getTooltip(object, Firebug.currentContext);
            if (label)
            {
                tooltip.setAttribute("label", label);
                return true;
            }
        }

        if (FBL.hasClass(target, 'noteInToolTip'))
            FBL.setClass(tooltip, 'noteInToolTip');
        else
            FBL.removeClass(tooltip, 'noteInToolTip');

        if (target && target.hasAttribute("title"))
        {
            tooltip.setAttribute("label", target.getAttribute("title"));
            return true;
        }

        return false;
    },

    openAboutDialog: function()
    {
        if (FBTrace.DBG_WINDOWS)
            FBTrace.sysout("Firebug.openAboutDialog");

        try
        {
            // Firefox 4.0 implements new AddonManager. In case of Firefox 3.6 the module
            // is not avaialble and there is an exception.
            Components.utils.import("resource://gre/modules/AddonManager.jsm");
        }
        catch (err)
        {
        }

        if (typeof(AddonManager) != "undefined")
        {
            AddonManager.getAddonByID("firebug@software.joehewitt.com", function(addon) {
                openDialog("chrome://mozapps/content/extensions/about.xul", "",
                "chrome,centerscreen,modal", addon);
            });
        }
        else
        {
            let extensionManager = FBL.CCSV("@mozilla.org/extensions/manager;1",
                "nsIExtensionManager");

            openDialog("chrome://mozapps/content/extensions/about.xul", "",
                "chrome,centerscreen,modal", "urn:mozilla:item:firebug@software.joehewitt.com",
                extensionManager.datasource);
        }
    },

    breakOnNext: function(context, event)
    {
        // Avoid bubbling from associated options.
        if (event.target.id != "cmd_breakOnNext")
            return;

        if (!context)
        {
            if (FBTrace.DBG_BP)
                FBTrace.sysout("Firebug chrome: breakOnNext with no context??");
            return;
        }

        let panel = panelBar1.selectedPanel;

        if (FBTrace.DBG_BP)
            FBTrace.sysout("Firebug chrome: breakOnNext for panel " +
                (panel ? panel.name : "NO panel"), panel);

        if (panel && panel.breakable)
            Firebug.Breakpoint.toggleBreakOnNext(panel);
    }
};

// ************************************************************************************************
// Welcome Page (first run)

let FirstRunPage =
{
    initializeUI: function()
    {
        // If the version in preferences is smaller than the current version
        // display the welcome page.
        if (FBL.checkFirebugVersion(Firebug.currentVersion) > 0)
        {
            FBTrace.sysout("FirstRunPage.initializeUI; current: " + Firebug.getVersion() +
                "preferences: " + Firebug.currentVersion);

            // Wait for session restore and display the welcome page.
            observerService.addObserver(this, "sessionstore-windows-restored" , false);
        }
    },

    observe: function(subjet, topic, data)
    {
        if (topic != "sessionstore-windows-restored")
            return;

        setTimeout(function()
        {
            // Open the page in the top most window so, the user can see it immediately.
            if (wm.getMostRecentWindow("navigator:browser") != window)
                return;

            // Avoid opening of the page in a second browser window.
            if (FBL.checkFirebugVersion(Firebug.currentVersion) > 0)
            {
                // Don't forget to update the preference so, the page is not displayed again
                let version = Firebug.getVersion();
                Firebug.setPref(Firebug.prefDomain, "currentVersion", version);
                version = version.replace('X', '', "g");

                // xxxHonza: put the URL in firebugURLs as soon as it's in chrome.js
                FBL.openNewTab("http://getfirebug.com/firstrun#Firebug " + version);
            }
        }, 500);
    }
};

// ************************************************************************************************
// Local Helpers

function panelSupportsObject(panelType, object, context)
{
    if (panelType)
    {
        try {
            // This tends to throw exceptions often because some objects are weird
            return panelType.prototype.supportsObject(object, typeof object, context);
        } catch (exc) {}
    }

    return 0;
}

function getBestPanelName(object, context, panelName)
{
    if (!panelName)
        panelName = context.panelName;

    // Check if the suggested panel name supports the object, and if so, go with it
    if (panelName)
    {
        panelType = Firebug.getPanelType(panelName);
        if (panelSupportsObject(panelType, object, context))
            return panelType.prototype.name;
    }

    // The suggested name didn't pan out, so search for the panel type with the
    // most specific level of support
    return getBestPanelSupportingObject(object, context);
}

function getBestPanelSupportingObject(object, context)
{
    let bestLevel = 0;
    let bestPanel = null;

    for (let i = 0; i < Firebug.panelTypes.length; ++i)
    {
        let panelType = Firebug.panelTypes[i];
        if (!panelType.prototype.parentPanel)
        {
            let level = panelSupportsObject(panelType, object, context);
            if (!bestLevel || (level && (level > bestLevel) ))
            {
                bestLevel = level;
                bestPanel = panelType;
            }
            if (FBTrace.DBG_PANELS)
                FBTrace.sysout("chrome.getBestPanelName panelType: "+panelType.prototype.name+" level: "+level+" bestPanel: "+ (bestPanel ? bestPanel.prototype.name : "null")+" bestLevel: "+bestLevel+"\n");
        }
    }

    return bestPanel ? bestPanel.prototype.name : null;
}

function getBestSidePanelName(sidePanelName, panelTypes)
{
    if (sidePanelName)
    {
        // Verify that the suggested panel name is in the acceptable list
        for (let i = 0; i < panelTypes.length; ++i)
        {
            if (panelTypes[i].prototype.name == sidePanelName)
                return sidePanelName;
        }
    }

    // Default to the first panel type in the list
    return panelTypes.length ? panelTypes[0].prototype.name : null;
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Event listeners

function browser1Loaded()
{
    if (FBTrace.DBG_INITIALIZE)
        FBTrace.sysout("browse1Loaded\n");
    let browser1 = panelBar1.browser;
    browser1.removeEventListener("load", browser1Loaded, true);

    browser1.contentDocument.title = "Firebug Main Panel";
    browser1Loaded.complete = true;

    if (browser1Loaded.complete && browser2Loaded.complete)
        FirebugChrome.initializeUI();
}

function browser2Loaded()
{
    if (FBTrace.DBG_INITIALIZE)
        FBTrace.sysout("browse2Loaded\n");
    let browser2 = panelBar2.browser;
    browser2.removeEventListener("load", browser2Loaded, true);

    browser2.contentDocument.title = "Firebug Side Panel";
    browser2Loaded.complete = true;

    if (browser1Loaded.complete && browser2Loaded.complete)
        FirebugChrome.initializeUI();  // the chrome bound into this scope

    if (FBTrace.DBG_INITIALIZE)
        FBTrace.sysout("browse2Loaded complete\n");
}

function onBlur(event)
{
    // XXXjjb this seems like a waste: called continuously to clear possible highlight I guess.
    // XXXhh Is this really necessary? I disabled it for now as this was preventing me to show highlights on focus
    //Firebug.Inspector.highlightObject(null, Firebug.currentContext);
}

function onSelectLocation(event)
{
    let location = locationList.repObject;
    FirebugChrome.navigate(location);
}

function onSelectingPanel(event)
{
    let panel = panelBar1.selectedPanel;
    let panelName = panel ? panel.name : null;

    if (FBTrace.DBG_PANELS)
        FBTrace.sysout("chrome.onSelectingPanel="+panelName+" Firebug.currentContext=" +
            (Firebug.currentContext?Firebug.currentContext.getName():"undefined"));

    if (Firebug.currentContext)
    {
        Firebug.currentContext.previousPanelName = Firebug.currentContext.panelName;
        Firebug.currentContext.panelName = panelName;

        Firebug.currentContext.sidePanelName =
            Firebug.currentContext.sidePanelNames && panelName in Firebug.currentContext.sidePanelNames
            ? Firebug.currentContext.sidePanelNames[panelName]
            : null;
    }

    if (panel)
        panel.navigate(panel.location);

    // Hide all toolbars now. It's a responsibility of the new selected panel to show
    // those toolbars that are necessary. This avoids the situation when naughty panel
    // doesn't clean up its toolbars. This must be done before showPanel where visibility
    // of the BON buttons is managed.
    let toolbar = $("fbToolbarInner");
    let child = toolbar.firstChild;
    while (child)
    {
        FBL.collapse(child, true);
        child = child.nextSibling;
    }

    // Calling Firebug.showPanel causes dispatching "showPanel" to all modules.
    let browser = panel ? panel.context.browser : FirebugChrome.getCurrentBrowser();
    Firebug.showPanel(browser, panel);

    // Synchronize UI around panels. Execute the sync after showPanel so the logic
    // can decide whether to display separators or not.
    // xxxHonza: The command line should be synced here as well.
    Firebug.chrome.syncLocationList();
    Firebug.chrome.syncStatusPath();

    //xxxjjb unfortunately the callstack side panel depends on the status path (sync after.)
    Firebug.chrome.syncSidePanels();
}

function onSelectedSidePanel(event)
{
    let sidePanel = panelBar2.selectedPanel;
    if (Firebug.currentContext)
    {
        let panelName = Firebug.currentContext.panelName;
        if (panelName)
        {
            let sidePanelName = sidePanel ? sidePanel.name : null;
            Firebug.currentContext.sidePanelNames[panelName] = sidePanelName;
        }
    }

    if (FBTrace.DBG_PANELS)
        FBTrace.sysout("chrome.onSelectedSidePanel name="+(sidePanel?sidePanel.name:"undefined")+"\n");

    let panel = panelBar1.selectedPanel;
    if (panel && sidePanel)
        sidePanel.select(panel.selection);

    let browser = sidePanel ? sidePanel.context.browser : FirebugChrome.getCurrentBrowser();
    Firebug.showSidePanel(browser, sidePanel);  // dispatch to modules
}

function onPanelMouseOver(event)
{
    let object = Firebug.getRepObject(event.target);
    if(!object)
        return;

    let rep = Firebug.getRep(object, Firebug.currentContext);
    if(rep)
        rep.highlightObject(object, Firebug.currentContext);
}

function onPanelMouseOut(event)
{
    let object = Firebug.getRepObject(event.target);
    if(!object)
        return;

    let rep = Firebug.getRep(object, Firebug.currentContext);
    if(rep)
        rep.unhighlightObject(object, Firebug.currentContext);
}

function onPanelClick(event)
{
    let repNode = Firebug.getRepNode(event.target);
    if (repNode)
    {
        let object = repNode.repObject;
        let rep = Firebug.getRep(object, Firebug.currentContext);
        let realObject = rep ? rep.getRealObject(object, Firebug.currentContext) : null;
        let realRep = realObject ? Firebug.getRep(realObject, Firebug.currentContext) : rep;
        if (!realObject)
            realObject = object;

        if (FBL.isLeftClick(event))
        {
            if (FBL.hasClass(repNode, "objectLink"))
            {
                if (realRep)
                {
                    realRep.inspectObject(realObject, Firebug.currentContext);
                    FBL.cancelEvent(event);
                }
            }
        }
        else if (FBL.isControlClick(event) || FBL.isMiddleClick(event))
        {
            if (!realRep || !realRep.browseObject(realObject, Firebug.currentContext))
            {
                if (rep && !(rep != realRep && rep.browseObject(object, Firebug.currentContext)))
                {
                    let panel = Firebug.getElementPanel(event.target);
                    if (!panel || !panel.browseObject(realObject))
                        return;
                }
            }
            FBL.cancelEvent(event);
        }
    }
}

function onPanelMouseDown(event)
{
    if (FBL.isLeftClick(event))
    {
        let editable = FBL.getAncestorByClass(event.target, "editable");
        if (editable)
        {
            Firebug.Editor.startEditing(editable);
            FBL.cancelEvent(event);
        }
    }
    else if (FBL.isMiddleClick(event) && Firebug.getRepNode(event.target))
    {
        // Prevent auto-scroll when middle-clicking a rep object
        FBL.cancelEvent(event);
    }
}

function onMainTabBoxMouseDown(event)
{
    if (Firebug.isInBrowser())
    {
        let contentSplitter = Firebug.chrome.$("fbContentSplitter");
        // TODO: grab the splitter here.
    }
}

function getRealObject(object)
{
    let rep = Firebug.getRep(object, Firebug.currentContext);
    let realObject = rep ? rep.getRealObject(object, Firebug.currentContext) : null;
    return realObject ? realObject : object;
}

// ************************************************************************************************
// Utils (duplicated from lib.js)

function $(id, doc)
{
    if (doc)
        return doc.getElementById(id);
    else
        return document.getElementById(id);
}

function cloneArray(array, fn)
{
   let newArray = [];

   for (let i = 0; i < array.length; ++i)
       newArray.push(array[i]);

   return newArray;
}

function bindFixed()
{
    let args = cloneArray(arguments), fn = args.shift(), object = args.shift();
    return function() { return fn.apply(object, args); };
}

})();

// ************************************************************************************************

// XXXjoe This horrible hack works around a focus bug in Firefox which is caused when
// the HTML Validator extension and Firebug are installed.  It causes the keyboard to
// behave erratically when typing, and the only solution I've found is to delay
// the initialization of HTML Validator by overriding this function with a timeout.
// XXXrobc Do we still need this? Does this extension even exist anymore?
if (top.hasOwnProperty('TidyBrowser'))
{
    let prev = TidyBrowser.prototype.updateStatusBar;
    TidyBrowser.prototype.updateStatusBar = function()
    {
        let self = this, args = arguments;
        setTimeout(function()
        {
            prev.apply(self, args);
        });
    };
}

// ************************************************************************************************

function dddx()
{
    Firebug.Console.logFormatted(arguments);
}

