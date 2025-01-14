/* See license.txt for terms of usage */

FBL.ns(function() { with (FBL) {

// ************************************************************************************************
// Constants

//const Cc = Components.classes;
//const Ci = Components.interfaces;

// List of contexts with XHR spy attached.
let contexts = [];

// ************************************************************************************************
// Spy Module

/**
 * @module Represents a XHR Spy module. The main purpose of the XHR Spy feature is to monitor
 * XHR activity of the current page and create appropriate log into the Console panel.
 * This feature can be controlled by an option <i>Show XMLHttpRequests</i> (from within the
 * console panel).
 * 
 * The module is responsible for attaching/detaching a HTTP Observers when Firebug is
 * activated/deactivated for a site.
 */
Firebug.Spy = extend(Firebug.Module,
/** @lends Firebug.Spy */
{
    dispatchName: "spy",

    initialize: function()
    {
        if (Firebug.TraceModule)
            Firebug.TraceModule.addListener(this.TraceListener);

        Firebug.Module.initialize.apply(this, arguments);
    },

    shutdown: function()
    {
        Firebug.Module.shutdown.apply(this, arguments);

        if (Firebug.TraceModule)
            Firebug.TraceModule.removeListener(this.TraceListener);
    },

    initContext: function(context)
    {
        context.spies = [];

        if (Firebug.showXMLHttpRequests && Firebug.Console.isAlwaysEnabled())
            this.attachObserver(context, context.window);

        if (FBTrace.DBG_SPY)
            FBTrace.sysout("spy.initContext " + contexts.length + " ", context.getName());
    },

    destroyContext: function(context)
    {
        // For any spies that are in progress, remove our listeners so that they don't leak
        this.detachObserver(context, null);

        if (FBTrace.DBG_SPY && context.spies.length)
            FBTrace.sysout("spy.destroyContext; ERROR There are leaking Spies ("
                + context.spies.length + ") " + context.getName());

        delete context.spies;

        if (FBTrace.DBG_SPY)
            FBTrace.sysout("spy.destroyContext " + contexts.length + " ", context.getName());
    },

    watchWindow: function(context, win)
    {
        if (Firebug.showXMLHttpRequests && Firebug.Console.isAlwaysEnabled())
            this.attachObserver(context, win);
    },

    unwatchWindow: function(context, win)
    {
        try
        {
            // This make sure that the existing context is properly removed from "contexts" array.
            this.detachObserver(context, win);
        }
        catch (ex)
        {
            // Get exceptions here sometimes, so let's just ignore them
            // since the window is going away anyhow
            ERROR(ex);
        }
    },

    updateOption: function(name, value)
    {
        // XXXjjb Honza, if Console.isEnabled(context) false, then this can't be called,
        // but somehow seems not correct
        if (name == "showXMLHttpRequests")
        {
            let tach = value ? this.attachObserver : this.detachObserver;
            for (let i = 0; i < TabWatcher.contexts.length; ++i)
            {
                let context = TabWatcher.contexts[i];
                iterateWindows(context.window, function(win)
                {
                    tach.apply(this, [context, win]);
                });
            }
        }
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // Attaching Spy to XHR requests.

    /**
     * Returns false if Spy should not be attached to XHRs executed by the specified window.
     */
    skipSpy: function(win)
    {
        if (!win)
            return true;

        // Don't attach spy to chrome.
        let uri = safeGetWindowLocation(win);
        if (uri && (uri.indexOf("about:") == 0 || uri.indexOf("chrome:") == 0))
            return true;
    },

    attachObserver: function(context, win)
    {
        if (Firebug.Spy.skipSpy(win))
            return;

        for (let i=0; i<contexts.length; ++i)
        {
            if ((contexts[i].context == context) && (contexts[i].win == win))
                return;
        }

        // Register HTTP observers only once.
        if (contexts.length == 0)
        {
            httpObserver.addObserver(SpyHttpObserver, "firebug-http-event", false);
            SpyHttpActivityObserver.registerObserver();
        }

        contexts.push({context: context, win: win});

        if (FBTrace.DBG_SPY)
            FBTrace.sysout("spy.attachObserver (HTTP) " + contexts.length + " ", context.getName());
    },

    detachObserver: function(context, win)
    {
        for (let i=0; i<contexts.length; ++i)
        {
            if (contexts[i].context == context)
            {
                if (win && (contexts[i].win != win))
                    continue;

                contexts.splice(i, 1);

                // If no context is using spy, remvove the (only one) HTTP observer.
                if (contexts.length == 0)
                {
                    httpObserver.removeObserver(SpyHttpObserver, "firebug-http-event");
                    SpyHttpActivityObserver.unregisterObserver();
                }

                if (FBTrace.DBG_SPY)
                    FBTrace.sysout("spy.detachObserver (HTTP) " + contexts.length + " ",
                        context.getName());
                return;
            }
        }
    },

    /**
     * Return XHR object that is associated with specified request <i>nsIHttpChannel</i>.
     * Returns null if the request doesn't represent XHR.
     */
    getXHR: function(request)
    {
        // Does also query-interface for nsIHttpChannel.
        if (!(request instanceof Ci.nsIHttpChannel))
            return null;

        try
        {
            let callbacks = request.notificationCallbacks;
            return (callbacks ? callbacks.getInterface(Ci.nsIXMLHttpRequest) : null);
        }
        catch (exc)
        {
            if (exc.name == "NS_NOINTERFACE")
            {
                if (FBTrace.DBG_SPY)
                    FBTrace.sysout("spy.getXHR; Request is not nsIXMLHttpRequest: " +
                        safeGetRequestName(request));
            }
        }

       return null;
    }
});





// ************************************************************************************************

/*
function getSpyForXHR(request, xhrRequest, context, noCreate)
{
    let spy = null;

    // Iterate all existing spy objects in this context and look for one that is
    // already created for this request.
    let length = context.spies.length;
    for (let i=0; i<length; i++)
    {
        spy = context.spies[i];
        if (spy.request == request)
            return spy;
    }

    if (noCreate)
        return null;

    spy = new Firebug.Spy.XMLHttpRequestSpy(request, xhrRequest, context);
    context.spies.push(spy);

    let name = request.URI.asciiSpec;
    let origName = request.originalURI.asciiSpec;

    // Attach spy only to the original request. Notice that there can be more network requests
    // made by the same XHR if redirects are involved.
    if (name == origName)
        spy.attach();

    if (FBTrace.DBG_SPY)
        FBTrace.sysout("spy.getSpyForXHR; New spy object created (" +
            (name == origName ? "new XHR" : "redirected XHR") + ") for: " + name, spy);

    return spy;
}
/**/

// ************************************************************************************************

/**
 * @class This class represents a Spy object that is attached to XHR. This object
 * registers letious listeners into the XHR in order to monitor letious events fired
 * during the request process (onLoad, onAbort, etc.)
 */
/*
Firebug.Spy.XMLHttpRequestSpy = function(request, xhrRequest, context)
{
    this.request = request;
    this.xhrRequest = xhrRequest;
    this.context = context;
    this.responseText = "";

    // For compatibility with the Net templates.
    this.isXHR = true;

    // Support for activity-observer
    this.transactionStarted = false;
    this.transactionClosed = false;
};
/**/

//Firebug.Spy.XMLHttpRequestSpy.prototype =
/** @lends Firebug.Spy.XMLHttpRequestSpy */
/*
{
    attach: function()
    {
        let spy = this;
        this.onReadyStateChange = function(event) { onHTTPSpyReadyStateChange(spy, event); };
        this.onLoad = function() { onHTTPSpyLoad(spy); };
        this.onError = function() { onHTTPSpyError(spy); };
        this.onAbort = function() { onHTTPSpyAbort(spy); };

        // xxxHonza: #502959 is still failing on Fx 3.5
        // Use activity distributor to identify 3.6 
        if (SpyHttpActivityObserver.getActivityDistributor())
        {
            this.onreadystatechange = this.xhrRequest.onreadystatechange;
            this.xhrRequest.onreadystatechange = this.onReadyStateChange;
        }

        this.xhrRequest.addEventListener("load", this.onLoad, false);
        this.xhrRequest.addEventListener("error", this.onError, false);
        this.xhrRequest.addEventListener("abort", this.onAbort, false);

        // xxxHonza: should be removed from FB 3.6
        if (!SpyHttpActivityObserver.getActivityDistributor())
            this.context.sourceCache.addListener(this);
    },

    detach: function()
    {
        // Bubble out if already detached.
        if (!this.onLoad)
            return;

        // If the activity distributor is available, let's detach it when the XHR
        // transaction is closed. Since, in case of multipart XHRs the onLoad method
        // (readyState == 4) can be called mutliple times.
        // Keep in mind:
        // 1) It can happen that that the TRANSACTION_CLOSE event comes before
        // the onLoad (if the XHR is made as part of the page load) so, detach if
        // it's already closed.
        // 2) In case of immediate cache responses, the transaction doesn't have to
        // be started at all (or the activity observer is no available in Firefox 3.5).
        // So, also detach in this case.
        if (this.transactionStarted && !this.transactionClosed)
            return;

        if (FBTrace.DBG_SPY)
            FBTrace.sysout("spy.detach; " + this.href);

        // Remove itself from the list of active spies.
        remove(this.context.spies, this);

        if (this.onreadystatechange)
            this.xhrRequest.onreadystatechange = this.onreadystatechange;

        try { this.xhrRequest.removeEventListener("load", this.onLoad, false); } catch (e) {}
        try { this.xhrRequest.removeEventListener("error", this.onError, false); } catch (e) {}
        try { this.xhrRequest.removeEventListener("abort", this.onAbort, false); } catch (e) {}

        this.onreadystatechange = null;
        this.onLoad = null;
        this.onError = null;
        this.onAbort = null;

        // xxxHonza: shouuld be removed from FB 1.6
        if (!SpyHttpActivityObserver.getActivityDistributor())
            this.context.sourceCache.removeListener(this);
    },

    getURL: function()
    {
        return this.xhrRequest.channel ? this.xhrRequest.channel.name : this.href;
    },

    // Cache listener
    onStopRequest: function(context, request, responseText)
    {
        if (!responseText)
            return;

        if (request == this.request)
            this.responseText = responseText;
    },
};
/**/
// ************************************************************************************************
/*
function onHTTPSpyReadyStateChange(spy, event)
{
    if (FBTrace.DBG_SPY)
        FBTrace.sysout("spy.onHTTPSpyReadyStateChange " + spy.xhrRequest.readyState +
            " (multipart: " + spy.xhrRequest.multipart + ")");

    // Remember just in case spy is detached (readyState == 4).
    let originalHandler = spy.onreadystatechange;

    // Force response text to be updated in the UI (in case the console entry
    // has been already expanded and the response tab selected).
    if (spy.logRow && spy.xhrRequest.readyState >= 3)
    {
        let netInfoBox = getChildByClass(spy.logRow, "spyHead", "netInfoBody");
        if (netInfoBox)
        {
            netInfoBox.htmlPresented = false;
            netInfoBox.responsePresented = false;
        }
    }

    // If the request is loading update the end time.
    if (spy.xhrRequest.readyState == 3)
    {
        spy.responseTime = spy.endTime - spy.sendTime;
        updateTime(spy);
    }

    // Request loaded. Get all the info from the request now, just in case the 
    // XHR would be aborted in the original onReadyStateChange handler.
    if (spy.xhrRequest.readyState == 4)
    {
        // Cumulate response so, multipart response content is properly displayed.
        if (SpyHttpActivityObserver.getActivityDistributor())
            spy.responseText += spy.xhrRequest.responseText;
        else
        {
            // xxxHonza: remove from FB 1.6
            if (!spy.responseText)
                spy.responseText = spy.xhrRequest.responseText;
        }

        // The XHR is loaded now (used also by the activity observer).
        spy.loaded = true;

        // Update UI.
        updateHttpSpyInfo(spy);

        // Notify Net pane about a request beeing loaded.
        // xxxHonza: I don't think this is necessary.
        let netProgress = spy.context.netProgress;
        if (netProgress)
            netProgress.post(netProgress.stopFile, [spy.request, spy.endTime, spy.postText, spy.responseText]);

        // Notify registered listeners about finish of the XHR.
        dispatch(Firebug.Spy.fbListeners, "onLoad", [spy.context, spy]);
    }

    // Pass the event to the original page handler.
    callPageHandler(spy, event, originalHandler);
}

function onHTTPSpyLoad(spy)
{
    if (FBTrace.DBG_SPY)
        FBTrace.sysout("spy.onHTTPSpyLoad: " + spy.href, spy);

    // Detach must be done in onLoad (not in onreadystatechange) otherwise
    // onAbort would not be handled.
    spy.detach();

    // xxxHonza: Still needed for Fx 3.5 (#502959)
    if (!SpyHttpActivityObserver.getActivityDistributor())
        onHTTPSpyReadyStateChange(spy, null);
}

function onHTTPSpyError(spy)
{
    if (FBTrace.DBG_SPY)
        FBTrace.sysout("spy.onHTTPSpyError; " + spy.href, spy);

    spy.detach();
    spy.loaded = true;

    if (spy.logRow)
    {
        removeClass(spy.logRow, "loading");
        setClass(spy.logRow, "error");
    }
}

function onHTTPSpyAbort(spy)
{
    if (FBTrace.DBG_SPY)
        FBTrace.sysout("spy.onHTTPSpyAbort: " + spy.href, spy);

    spy.detach();
    spy.loaded = true;

    if (spy.logRow)
    {
        removeClass(spy.logRow, "loading");
        setClass(spy.logRow, "error");
    }

    spy.statusText = "Aborted";
    updateLogRow(spy);

    // Notify Net pane about a request beeing aborted.
    // xxxHonza: the net panel shoud find out this itself.
    let netProgress = spy.context.netProgress;
    if (netProgress)
        netProgress.post(netProgress.abortFile, [spy.request, spy.endTime, spy.postText, spy.responseText]);
}
/**/

// ************************************************************************************************

/**
 * @domplate Represents a template for XHRs logged in the Console panel. The body of the
 * log (displayed when expanded) is rendered using {@link Firebug.NetMonitor.NetInfoBody}.
 */

Firebug.Spy.XHR = domplate(Firebug.Rep,
/** @lends Firebug.Spy.XHR */

{
    tag:
        DIV({"class": "spyHead", _repObject: "$object"},
            TABLE({"class": "spyHeadTable focusRow outerFocusRow", cellpadding: 0, cellspacing: 0,
                "role": "listitem", "aria-expanded": "false"},
                TBODY({"role": "presentation"},
                    TR({"class": "spyRow"},
                        TD({"class": "spyTitleCol spyCol", onclick: "$onToggleBody"},
                            DIV({"class": "spyTitle"},
                                "$object|getCaption"
                            ),
                            DIV({"class": "spyFullTitle spyTitle"},
                                "$object|getFullUri"
                            )
                        ),
                        TD({"class": "spyCol"},
                            DIV({"class": "spyStatus"}, "$object|getStatus")
                        ),
                        TD({"class": "spyCol"},
                            SPAN({"class": "spyIcon"})
                        ),
                        TD({"class": "spyCol"},
                            SPAN({"class": "spyTime"})
                        ),
                        TD({"class": "spyCol"},
                            TAG(FirebugReps.SourceLink.tag, {object: "$object.sourceLink"})
                        )
                    )
                )
            )
        ),

    getCaption: function(spy)
    {
        return spy.method.toUpperCase() + " " + cropString(spy.getURL(), 100);
    },

    getFullUri: function(spy)
    {
        return spy.method.toUpperCase() + " " + spy.getURL();
    },

    getStatus: function(spy)
    {
        let text = "";
        if (spy.statusCode)
            text += spy.statusCode + " ";

        if (spy.statusText)
            return text += spy.statusText;

        return text;
    },

    onToggleBody: function(event)
    {
        let target = event.currentTarget || event.srcElement;
        let logRow = getAncestorByClass(target, "logRow-spy");

        if (isLeftClick(event))
        {
            toggleClass(logRow, "opened");

            let spy = getChildByClass(logRow, "spyHead").repObject;
            let spyHeadTable = getAncestorByClass(target, "spyHeadTable");

            if (hasClass(logRow, "opened"))
            {
                updateHttpSpyInfo(spy, logRow);
                if (spyHeadTable)
                    spyHeadTable.setAttribute('aria-expanded', 'true');
            }
            else
            {
                //let netInfoBox = getChildByClass(spy.logRow, "spyHead", "netInfoBody");
                //dispatch(Firebug.NetMonitor.NetInfoBody.fbListeners, "destroyTabBody", [netInfoBox, spy]);
                //if (spyHeadTable)
                //    spyHeadTable.setAttribute('aria-expanded', 'false');
            }
        }
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    copyURL: function(spy)
    {
        copyToClipboard(spy.getURL());
    },

    copyParams: function(spy)
    {
        let text = spy.postText;
        if (!text)
            return;

        let url = reEncodeURL(spy, text, true);
        copyToClipboard(url);
    },

    copyResponse: function(spy)
    {
        copyToClipboard(spy.responseText);
    },

    openInTab: function(spy)
    {
        openNewTab(spy.getURL(), spy.postText);
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    supportsObject: function(object)
    {
        // TODO: xxxpedro spy xhr
        return false;
        
        return object instanceof Firebug.Spy.XMLHttpRequestSpy;
    },

    browseObject: function(spy, context)
    {
        let url = spy.getURL();
        openNewTab(url);
        return true;
    },

    getRealObject: function(spy, context)
    {
        return spy.xhrRequest;
    },

    getContextMenuItems: function(spy)
    {
        let items = [
            {label: "CopyLocation", command: bindFixed(this.copyURL, this, spy) }
        ];

        if (spy.postText)
        {
            items.push(
                {label: "CopyLocationParameters", command: bindFixed(this.copyParams, this, spy) }
            );
        }

        items.push(
            {label: "CopyResponse", command: bindFixed(this.copyResponse, this, spy) },
            "-",
            {label: "OpenInTab", command: bindFixed(this.openInTab, this, spy) }
        );

        return items;
    }
});

// ************************************************************************************************

function updateTime(spy)
{
    let timeBox = spy.logRow.getElementsByClassName("spyTime").item(0);
    if (spy.responseTime)
        timeBox.textContent = " " + formatTime(spy.responseTime);
}

function updateLogRow(spy)
{
    updateTime(spy);

    let statusBox = spy.logRow.getElementsByClassName("spyStatus").item(0);
    statusBox.textContent = Firebug.Spy.XHR.getStatus(spy);

    removeClass(spy.logRow, "loading");
    setClass(spy.logRow, "loaded");

    try
    {
        let errorRange = Math.floor(spy.xhrRequest.status/100);
        if (errorRange == 4 || errorRange == 5)
            setClass(spy.logRow, "error");
    }
    catch (exc)
    {
    }
}

let updateHttpSpyInfo = function updateHttpSpyInfo(spy, logRow)
{
    if (!spy.logRow && logRow)
        spy.logRow = logRow;
    
    if (!spy.logRow || !hasClass(spy.logRow, "opened"))
        return;

    if (!spy.params)
        //spy.params = parseURLParams(spy.href+"");
        spy.params = parseURLParams(spy.href+"");

    if (!spy.requestHeaders)
        spy.requestHeaders = getRequestHeaders(spy);

    if (!spy.responseHeaders && spy.loaded)
        spy.responseHeaders = getResponseHeaders(spy);

    let template = Firebug.NetMonitor.NetInfoBody;
    let netInfoBox = getChildByClass(spy.logRow, "spyHead", "netInfoBody");
    if (!netInfoBox)
    {
        let head = getChildByClass(spy.logRow, "spyHead");
        netInfoBox = template.tag.append({"file": spy}, head);
        dispatch(template.fbListeners, "initTabBody", [netInfoBox, spy]);
        template.selectTabByName(netInfoBox, "Response");
    }
    else
    {
        template.updateInfo(netInfoBox, spy, spy.context);
    }
};



// ************************************************************************************************

function getRequestHeaders(spy)
{
    let headers = [];

    let channel = spy.xhrRequest.channel;
    if (channel instanceof Ci.nsIHttpChannel)
    {
        channel.visitRequestHeaders({
            visitHeader: function(name, value)
            {
                headers.push({name: name, value: value});
            }
        });
    }

    return headers;
}

function getResponseHeaders(spy)
{
    let headers = [];

    try
    {
        let channel = spy.xhrRequest.channel;
        if (channel instanceof Ci.nsIHttpChannel)
        {
            channel.visitResponseHeaders({
                visitHeader: function(name, value)
                {
                    headers.push({name: name, value: value});
                }
            });
        }
    }
    catch (exc)
    {
        if (FBTrace.DBG_SPY || FBTrace.DBG_ERRORS)
            FBTrace.sysout("spy.getResponseHeaders; EXCEPTION " +
                safeGetRequestName(spy.request), exc);
    }

    return headers;
}

// ************************************************************************************************
// Registration

Firebug.registerModule(Firebug.Spy);
//Firebug.registerRep(Firebug.Spy.XHR);

// ************************************************************************************************
}});
