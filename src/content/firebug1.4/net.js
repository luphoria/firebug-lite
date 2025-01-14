/* See license.txt for terms of usage */

FBL.ns(function() { with (FBL) {
// ************************************************************************************************

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

let reIgnore = /about:|javascript:|resource:|chrome:|jar:/;
let layoutInterval = 300;
let indentWidth = 18;

let cacheSession = null;
let contexts = new Array();
let panelName = "net";
let maxQueueRequests = 500;
//let panelBar1 = $("fbPanelBar1"); // chrome not available at startup
let activeRequests = [];

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

let mimeExtensionMap =
{
    "txt": "text/plain",
    "html": "text/html",
    "htm": "text/html",
    "xhtml": "text/html",
    "xml": "text/xml",
    "css": "text/css",
    "js": "application/x-javascript",
    "jss": "application/x-javascript",
    "jpg": "image/jpg",
    "jpeg": "image/jpeg",
    "gif": "image/gif",
    "png": "image/png",
    "bmp": "image/bmp",
    "swf": "application/x-shockwave-flash",
    "flv": "video/x-flv"
};

let fileCategories =
{
    "undefined": 1,
    "html": 1,
    "css": 1,
    "js": 1,
    "xhr": 1,
    "image": 1,
    "flash": 1,
    "txt": 1,
    "bin": 1
};

let textFileCategories =
{
    "txt": 1,
    "html": 1,
    "xhr": 1,
    "css": 1,
    "js": 1
};

let binaryFileCategories =
{
    "bin": 1,
    "flash": 1
};

let mimeCategoryMap =
{
    "text/plain": "txt",
    "application/octet-stream": "bin",
    "text/html": "html",
    "text/xml": "html",
    "text/css": "css",
    "application/x-javascript": "js",
    "text/javascript": "js",
    "application/javascript" : "js",
    "image/jpeg": "image",
    "image/jpg": "image",
    "image/gif": "image",
    "image/png": "image",
    "image/bmp": "image",
    "application/x-shockwave-flash": "flash",
    "video/x-flv": "flash"
};

let binaryCategoryMap =
{
    "image": 1,
    "flash" : 1
};

// ************************************************************************************************

/**
 * @module Represents a module object for the Net panel. This object is derived
 * from <code>Firebug.ActivableModule</code> in order to support activation (enable/disable).
 * This allows to avoid (performance) expensive features if the functionality is not necessary
 * for the user.
 */
Firebug.NetMonitor = extend(Firebug.ActivableModule,
{
    dispatchName: "netMonitor",
    
    clear: function(context)
    {
        // The user pressed a Clear button so, remove content of the panel...
        let panel = context.getPanel(panelName, true);
        if (panel)
            panel.clear();
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // extends Module

    initialize: function()
    {
        return;
        
        this.panelName = panelName;

        Firebug.ActivableModule.initialize.apply(this, arguments);

        if (Firebug.TraceModule)
            Firebug.TraceModule.addListener(this.TraceListener);

        // HTTP observer must be registered now (and not in monitorContext, since if a
        // page is opened in a new tab the top document request would be missed otherwise.
        NetHttpObserver.registerObserver();
        NetHttpActivityObserver.registerObserver();

        Firebug.Debugger.addListener(this.DebuggerListener);
    },

    shutdown: function()
    {
        return;
        
        prefs.removeObserver(Firebug.prefDomain, this, false);
        if (Firebug.TraceModule)
            Firebug.TraceModule.removeListener(this.TraceListener);

        NetHttpObserver.unregisterObserver();
        NetHttpActivityObserver.unregisterObserver();

        Firebug.Debugger.removeListener(this.DebuggerListener);
    }
});


/**
 * @domplate Represents a template that is used to reneder detailed info about a request.
 * This template is rendered when a request is expanded.
 */
Firebug.NetMonitor.NetInfoBody = domplate(Firebug.Rep, new Firebug.Listener(),
{
    tag:
        DIV({"class": "netInfoBody", _repObject: "$file"},
            TAG("$infoTabs", {file: "$file"}),
            TAG("$infoBodies", {file: "$file"})
        ),

    infoTabs:
        DIV({"class": "netInfoTabs focusRow subFocusRow", "role": "tablist"},
            A({"class": "netInfoParamsTab netInfoTab a11yFocus", onclick: "$onClickTab", "role": "tab",
                view: "Params",
                $collapsed: "$file|hideParams"},
                $STR("URLParameters")
            ),
            A({"class": "netInfoHeadersTab netInfoTab a11yFocus", onclick: "$onClickTab", "role": "tab",
                view: "Headers"},
                $STR("Headers")
            ),
            A({"class": "netInfoPostTab netInfoTab a11yFocus", onclick: "$onClickTab", "role": "tab",
                view: "Post",
                $collapsed: "$file|hidePost"},
                $STR("Post")
            ),
            A({"class": "netInfoPutTab netInfoTab a11yFocus", onclick: "$onClickTab", "role": "tab",
                view: "Put",
                $collapsed: "$file|hidePut"},
                $STR("Put")
            ),
            A({"class": "netInfoResponseTab netInfoTab a11yFocus", onclick: "$onClickTab", "role": "tab",
                view: "Response",
                $collapsed: "$file|hideResponse"},
                $STR("Response")
            ),
            A({"class": "netInfoCacheTab netInfoTab a11yFocus", onclick: "$onClickTab", "role": "tab",
               view: "Cache",
               $collapsed: "$file|hideCache"},
               $STR("Cache")
            ),
            A({"class": "netInfoHtmlTab netInfoTab a11yFocus", onclick: "$onClickTab", "role": "tab",
               view: "Html",
               $collapsed: "$file|hideHtml"},
               $STR("HTML")
            )
        ),

    infoBodies:
        DIV({"class": "netInfoBodies outerFocusRow"},
            TABLE({"class": "netInfoParamsText netInfoText netInfoParamsTable", "role": "tabpanel",
                    cellpadding: 0, cellspacing: 0}, TBODY()),
            DIV({"class": "netInfoHeadersText netInfoText", "role": "tabpanel"}),
            DIV({"class": "netInfoPostText netInfoText", "role": "tabpanel"}),
            DIV({"class": "netInfoPutText netInfoText", "role": "tabpanel"}),
            PRE({"class": "netInfoResponseText netInfoText", "role": "tabpanel"}),
            DIV({"class": "netInfoCacheText netInfoText", "role": "tabpanel"},
                TABLE({"class": "netInfoCacheTable", cellpadding: 0, cellspacing: 0, "role": "presentation"},
                    TBODY({"role": "list", "aria-label": $STR("Cache")})
                )
            ),
            DIV({"class": "netInfoHtmlText netInfoText", "role": "tabpanel"},
                IFRAME({"class": "netInfoHtmlPreview", "role": "document"})
            )
        ),

    headerDataTag:
        FOR("param", "$headers",
            TR({"role": "listitem"},
                TD({"class": "netInfoParamName", "role": "presentation"},
                    TAG("$param|getNameTag", {param: "$param"})
                ),
                TD({"class": "netInfoParamValue", "role": "list", "aria-label": "$param.name"},
                    FOR("line", "$param|getParamValueIterator",
                        CODE({"class": "focusRow subFocusRow", "role": "listitem"}, "$line")
                    )
                )
            )
        ),

    customTab:
        A({"class": "netInfo$tabId\\Tab netInfoTab", onclick: "$onClickTab", view: "$tabId", "role": "tab"},
            "$tabTitle"
        ),

    customBody:
        DIV({"class": "netInfo$tabId\\Text netInfoText", "role": "tabpanel"}),

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    nameTag:
        SPAN("$param|getParamName"),

    nameWithTooltipTag:
        SPAN({title: "$param.name"}, "$param|getParamName"),

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    getNameTag: function(param)
    {
        return (this.getParamName(param) == param.name) ? this.nameTag : this.nameWithTooltipTag;
    },

    getParamName: function(param)
    {
        let limit = 25;
        let name = param.name;
        if (name.length > limit)
            name = name.substr(0, limit) + "...";
        return name;
    },

    getParamTitle: function(param)
    {
        let limit = 25;
        let name = param.name;
        if (name.length > limit)
            return name;
        return "";
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    hideParams: function(file)
    {
        return !file.urlParams || !file.urlParams.length;
    },

    hidePost: function(file)
    {
        return file.method.toUpperCase() != "POST";
    },

    hidePut: function(file)
    {
        return file.method.toUpperCase() != "PUT";
    },

    hideResponse: function(file)
    {
        return false;
        //return file.category in binaryFileCategories;
    },

    hideCache: function(file)
    {
        return true;
        //xxxHonza: I don't see any reason why not to display the cache also info for images.
        return !file.cacheEntry; // || file.category=="image";
    },

    hideHtml: function(file)
    {
        return (file.mimeType != "text/html") && (file.mimeType != "application/xhtml+xml");
    },

    onClickTab: function(event)
    {
        this.selectTab(event.currentTarget || event.srcElement);
    },

    getParamValueIterator: function(param)
    {
        // TODO: xxxpedro console2
        return param.value;
        
        // This value is inserted into CODE element and so, make sure the HTML isn't escaped (1210).
        // This is why the second parameter is true.
        // The CODE (with style white-space:pre) element preserves whitespaces so they are
        // displayed the same, as they come from the server (1194).
        // In case of a long header values of post parameters the value must be wrapped (2105).
        return wrapText(param.value, true);
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    appendTab: function(netInfoBox, tabId, tabTitle)
    {
        // Create new tab and body.
        let args = {tabId: tabId, tabTitle: tabTitle};
        ///this.customTab.append(args, netInfoBox.getElementsByClassName("netInfoTabs").item(0));
        ///this.customBody.append(args, netInfoBox.getElementsByClassName("netInfoBodies").item(0));
        this.customTab.append(args, $$(".netInfoTabs", netInfoBox)[0]);
        this.customBody.append(args, $$(".netInfoBodies", netInfoBox)[0]);
    },

    selectTabByName: function(netInfoBox, tabName)
    {
        let tab = getChildByClass(netInfoBox, "netInfoTabs", "netInfo"+tabName+"Tab");
        if (tab)
            this.selectTab(tab);
    },

    selectTab: function(tab)
    {
        let view = tab.getAttribute("view");
        
        let netInfoBox = getAncestorByClass(tab, "netInfoBody");
        
        let selectedTab = netInfoBox.selectedTab;

        if (selectedTab)
        {
            //netInfoBox.selectedText.removeAttribute("selected");
            removeClass(netInfoBox.selectedText, "netInfoTextSelected");
            
            removeClass(selectedTab, "netInfoTabSelected");
            //selectedTab.removeAttribute("selected");
            selectedTab.setAttribute("aria-selected", "false");
        }

        let textBodyName = "netInfo" + view + "Text";

        selectedTab = netInfoBox.selectedTab = tab;
        
        netInfoBox.selectedText = $$("."+textBodyName, netInfoBox)[0];
        //netInfoBox.selectedText = netInfoBox.getElementsByClassName(textBodyName).item(0);

        //netInfoBox.selectedText.setAttribute("selected", "true");
        setClass(netInfoBox.selectedText, "netInfoTextSelected");
        
        setClass(selectedTab, "netInfoTabSelected");
        selectedTab.setAttribute("selected", "true");
        selectedTab.setAttribute("aria-selected", "true");

        let file = Firebug.getRepObject(netInfoBox);
        
        //let context = Firebug.getElementPanel(netInfoBox).context;
        let context = Firebug.chrome;
        
        this.updateInfo(netInfoBox, file, context);
    },

    updateInfo: function(netInfoBox, file, context)
    {
        if (FBTrace.DBG_NET)
            FBTrace.sysout("net.updateInfo; file", file);

        if (!netInfoBox)
        {
            if (FBTrace.DBG_NET || FBTrace.DBG_ERRORS)
                FBTrace.sysout("net.updateInfo; ERROR netInfo == null " + file.href, file);
            return;
        }

        let tab = netInfoBox.selectedTab;
        
        if (hasClass(tab, "netInfoParamsTab"))
        {
            if (file.urlParams && !netInfoBox.urlParamsPresented)
            {
                netInfoBox.urlParamsPresented = true;
                this.insertHeaderRows(netInfoBox, file.urlParams, "Params");
            }
        }

        else if (hasClass(tab, "netInfoHeadersTab"))
        {
            let headersText = $$(".netInfoHeadersText", netInfoBox)[0];
            //let headersText = netInfoBox.getElementsByClassName("netInfoHeadersText").item(0);

            if (file.responseHeaders && !netInfoBox.responseHeadersPresented)
            {
                netInfoBox.responseHeadersPresented = true;
                NetInfoHeaders.renderHeaders(headersText, file.responseHeaders, "ResponseHeaders");
            }

            if (file.requestHeaders && !netInfoBox.requestHeadersPresented)
            {
                netInfoBox.requestHeadersPresented = true;
                NetInfoHeaders.renderHeaders(headersText, file.requestHeaders, "RequestHeaders");
            }
        }

        else if (hasClass(tab, "netInfoPostTab"))
        {
            if (!netInfoBox.postPresented)
            {
                netInfoBox.postPresented  = true;
                //let postText = netInfoBox.getElementsByClassName("netInfoPostText").item(0);
                let postText = $$(".netInfoPostText", netInfoBox)[0];
                NetInfoPostData.render(context, postText, file);
            }
        }

        else if (hasClass(tab, "netInfoPutTab"))
        {
            if (!netInfoBox.putPresented)
            {
                netInfoBox.putPresented  = true;
                //let putText = netInfoBox.getElementsByClassName("netInfoPutText").item(0);
                let putText = $$(".netInfoPutText", netInfoBox)[0];
                NetInfoPostData.render(context, putText, file);
            }
        }

        else if (hasClass(tab, "netInfoResponseTab") && file.loaded && !netInfoBox.responsePresented)
        {
            ///let responseTextBox = netInfoBox.getElementsByClassName("netInfoResponseText").item(0);
            let responseTextBox = $$(".netInfoResponseText", netInfoBox)[0];
            if (file.category == "image")
            {
                netInfoBox.responsePresented = true;

                let responseImage = netInfoBox.ownerDocument.createElement("img");
                responseImage.src = file.href;

                clearNode(responseTextBox);
                responseTextBox.appendChild(responseImage, responseTextBox);
            }
            else ///if (!(binaryCategoryMap.hasOwnProperty(file.category)))
            {
                this.setResponseText(file, netInfoBox, responseTextBox, context);
            }
        }

        else if (hasClass(tab, "netInfoCacheTab") && file.loaded && !netInfoBox.cachePresented)
        {
            let responseTextBox = netInfoBox.getElementsByClassName("netInfoCacheText").item(0);
            if (file.cacheEntry) {
                netInfoBox.cachePresented = true;
                this.insertHeaderRows(netInfoBox, file.cacheEntry, "Cache");
            }
        }

        else if (hasClass(tab, "netInfoHtmlTab") && file.loaded && !netInfoBox.htmlPresented)
        {
            netInfoBox.htmlPresented = true;

            let text = Utils.getResponseText(file, context);
            
            ///let iframe = netInfoBox.getElementsByClassName("netInfoHtmlPreview").item(0);
            let iframe = $$(".netInfoHtmlPreview", netInfoBox)[0];
            
            ///iframe.contentWindow.document.body.innerHTML = text;
            
            // TODO: xxxpedro net - remove scripts
            let reScript = /<script(.|\s)*?\/script>/gi;
            
            text = text.replace(reScript, "");
                
            iframe.contentWindow.document.write(text);
            iframe.contentWindow.document.close();
        }

        // Notify listeners about update so, content of custom tabs can be updated.
        dispatch(NetInfoBody.fbListeners, "updateTabBody", [netInfoBox, file, context]);
    },

    setResponseText: function(file, netInfoBox, responseTextBox, context)
    {
        //**********************************************
        //**********************************************
        //**********************************************
        netInfoBox.responsePresented = true;
        // line breaks somehow are different in IE
        // make this only once in the initialization? we don't have net panels and modules yet.
        if (isIE)
            responseTextBox.style.whiteSpace = "nowrap";
        
        responseTextBox[
                typeof responseTextBox.textContent != "undefined" ? 
                        "textContent" : 
                        "innerText"
            ] = file.responseText;
        
        return;
        //**********************************************
        //**********************************************
        //**********************************************
        
        // Get response text and make sure it doesn't exceed the max limit.
        let text = Utils.getResponseText(file, context);
        let limit = Firebug.netDisplayedResponseLimit + 15;
        let limitReached = text ? (text.length > limit) : false;
        if (limitReached)
            text = text.substr(0, limit) + "...";

        // Insert the response into the UI.
        if (text)
            insertWrappedText(text, responseTextBox);
        else
            insertWrappedText("", responseTextBox);

        // Append a message informing the user that the response isn't fully displayed.
        if (limitReached)
        {
            let object = {
                text: $STR("net.responseSizeLimitMessage"),
                onClickLink: function() {
                    let panel = context.getPanel("net", true);
                    panel.openResponseInTab(file);
                }
            };
            Firebug.NetMonitor.ResponseSizeLimit.append(object, responseTextBox);
        }

        netInfoBox.responsePresented = true;

        if (FBTrace.DBG_NET)
            FBTrace.sysout("net.setResponseText; response text updated");
    },

    insertHeaderRows: function(netInfoBox, headers, tableName, rowName)
    {
        if (!headers.length)
            return;

        let headersTable = $$(".netInfo"+tableName+"Table", netInfoBox)[0];
        //let headersTable = netInfoBox.getElementsByClassName("netInfo"+tableName+"Table").item(0);
        let tbody = getChildByClass(headersTable, "netInfo" + rowName + "Body");
        if (!tbody)
            tbody = headersTable.firstChild;
        let titleRow = getChildByClass(tbody, "netInfo" + rowName + "Title");

        this.headerDataTag.insertRows({headers: headers}, titleRow ? titleRow : tbody);
        removeClass(titleRow, "collapsed");
    }
});

let NetInfoBody = Firebug.NetMonitor.NetInfoBody;

// ************************************************************************************************

/**
 * @domplate Used within the Net panel to display raw source of request and response headers
 * as well as pretty-formatted summary of these headers.
 */
Firebug.NetMonitor.NetInfoHeaders = domplate(Firebug.Rep, //new Firebug.Listener(),
{
    tag:
        DIV({"class": "netInfoHeadersTable", "role": "tabpanel"},
            DIV({"class": "netInfoHeadersGroup netInfoResponseHeadersTitle"},
                SPAN($STR("ResponseHeaders")),
                SPAN({"class": "netHeadersViewSource response collapsed", onclick: "$onViewSource",
                    _sourceDisplayed: false, _rowName: "ResponseHeaders"},
                    $STR("net.headers.view source")
                )
            ),
            TABLE({cellpadding: 0, cellspacing: 0},
                TBODY({"class": "netInfoResponseHeadersBody", "role": "list",
                    "aria-label": $STR("ResponseHeaders")})
            ),
            DIV({"class": "netInfoHeadersGroup netInfoRequestHeadersTitle"},
                SPAN($STR("RequestHeaders")),
                SPAN({"class": "netHeadersViewSource request collapsed", onclick: "$onViewSource",
                    _sourceDisplayed: false, _rowName: "RequestHeaders"},
                    $STR("net.headers.view source")
                )
            ),
            TABLE({cellpadding: 0, cellspacing: 0},
                TBODY({"class": "netInfoRequestHeadersBody", "role": "list",
                    "aria-label": $STR("RequestHeaders")})
            )
        ),

    sourceTag:
        TR({"role": "presentation"},
            TD({colspan: 2, "role": "presentation"},
                PRE({"class": "source"})
            )
        ),

    onViewSource: function(event)
    {
        let target = event.target;
        let requestHeaders = (target.rowName == "RequestHeaders");

        let netInfoBox = getAncestorByClass(target, "netInfoBody");
        let file = netInfoBox.repObject;

        if (target.sourceDisplayed)
        {
            let headers = requestHeaders ? file.requestHeaders : file.responseHeaders;
            this.insertHeaderRows(netInfoBox, headers, target.rowName);
            target.innerHTML = $STR("net.headers.view source");
        }
        else
        {
            let source = requestHeaders ? file.requestHeadersText : file.responseHeadersText;
            this.insertSource(netInfoBox, source, target.rowName);
            target.innerHTML = $STR("net.headers.pretty print");
        }

        target.sourceDisplayed = !target.sourceDisplayed;

        cancelEvent(event);
    },

    insertSource: function(netInfoBox, source, rowName)
    {
        // This breaks copy to clipboard.
        //if (source)
        //    source = source.replace(/\r\n/gm, "<span style='color:lightgray'>\\r\\n</span>\r\n");

        ///let tbody = netInfoBox.getElementsByClassName("netInfo" + rowName + "Body").item(0);
        let tbody = $$(".netInfo" + rowName + "Body", netInfoBox)[0];
        let node = this.sourceTag.replace({}, tbody);
        ///let sourceNode = node.getElementsByClassName("source").item(0);
        let sourceNode = $$(".source", node)[0];
        sourceNode.innerHTML = source;
    },

    insertHeaderRows: function(netInfoBox, headers, rowName)
    {
        let headersTable = $$(".netInfoHeadersTable", netInfoBox)[0];
        let tbody = $$(".netInfo" + rowName + "Body", headersTable)[0];
        
        //let headersTable = netInfoBox.getElementsByClassName("netInfoHeadersTable").item(0);
        //let tbody = headersTable.getElementsByClassName("netInfo" + rowName + "Body").item(0);

        clearNode(tbody);

        if (!headers.length)
            return;

        NetInfoBody.headerDataTag.insertRows({headers: headers}, tbody);

        let titleRow = getChildByClass(headersTable, "netInfo" + rowName + "Title");
        removeClass(titleRow, "collapsed");
    },

    init: function(parent)
    {
        let rootNode = this.tag.append({}, parent);

        let netInfoBox = getAncestorByClass(parent, "netInfoBody");
        let file = netInfoBox.repObject;

        let viewSource;

        viewSource = $$(".request", rootNode)[0];
        //viewSource = rootNode.getElementsByClassName("netHeadersViewSource request").item(0);
        if (file.requestHeadersText)
            removeClass(viewSource, "collapsed");

        viewSource = $$(".response", rootNode)[0];
        //viewSource = rootNode.getElementsByClassName("netHeadersViewSource response").item(0);
        if (file.responseHeadersText)
            removeClass(viewSource, "collapsed");
    },

    renderHeaders: function(parent, headers, rowName)
    {
        if (!parent.firstChild)
            this.init(parent);

        this.insertHeaderRows(parent, headers, rowName);
    }
});

let NetInfoHeaders = Firebug.NetMonitor.NetInfoHeaders;

// ************************************************************************************************

/**
 * @domplate Represents posted data within request info (the info, which is visible when
 * a request entry is expanded. This template renders content of the Post tab.
 */
Firebug.NetMonitor.NetInfoPostData = domplate(Firebug.Rep, /*new Firebug.Listener(),*/
{
    // application/x-www-form-urlencoded
    paramsTable:
        TABLE({"class": "netInfoPostParamsTable", cellpadding: 0, cellspacing: 0, "role": "presentation"},
            TBODY({"role": "list", "aria-label": $STR("net.label.Parameters")},
                TR({"class": "netInfoPostParamsTitle", "role": "presentation"},
                    TD({colspan: 3, "role": "presentation"},
                        DIV({"class": "netInfoPostParams"},
                            $STR("net.label.Parameters"),
                            SPAN({"class": "netInfoPostContentType"},
                                "application/x-www-form-urlencoded"
                            )
                        )
                    )
                )
            )
        ),

    // multipart/form-data
    partsTable:
        TABLE({"class": "netInfoPostPartsTable", cellpadding: 0, cellspacing: 0, "role": "presentation"},
            TBODY({"role": "list", "aria-label": $STR("net.label.Parts")},
                TR({"class": "netInfoPostPartsTitle", "role": "presentation"},
                    TD({colspan: 2, "role":"presentation" },
                        DIV({"class": "netInfoPostParams"},
                            $STR("net.label.Parts"),
                            SPAN({"class": "netInfoPostContentType"},
                                "multipart/form-data"
                            )
                        )
                    )
                )
            )
        ),

    // application/json
    jsonTable:
        TABLE({"class": "netInfoPostJSONTable", cellpadding: 0, cellspacing: 0, "role": "presentation"},
            ///TBODY({"role": "list", "aria-label": $STR("jsonviewer.tab.JSON")},
            TBODY({"role": "list", "aria-label": $STR("JSON")},
                TR({"class": "netInfoPostJSONTitle", "role": "presentation"},
                    TD({"role": "presentation" },
                        DIV({"class": "netInfoPostParams"},
                            ///$STR("jsonviewer.tab.JSON")
                            $STR("JSON")
                        )
                    )
                ),
                TR(
                    TD({"class": "netInfoPostJSONBody"})
                )
            )
        ),

    // application/xml
    xmlTable:
        TABLE({"class": "netInfoPostXMLTable", cellpadding: 0, cellspacing: 0, "role": "presentation"},
            TBODY({"role": "list", "aria-label": $STR("xmlviewer.tab.XML")},
                TR({"class": "netInfoPostXMLTitle", "role": "presentation"},
                    TD({"role": "presentation" },
                        DIV({"class": "netInfoPostParams"},
                            $STR("xmlviewer.tab.XML")
                        )
                    )
                ),
                TR(
                    TD({"class": "netInfoPostXMLBody"})
                )
            )
        ),

    sourceTable:
        TABLE({"class": "netInfoPostSourceTable", cellpadding: 0, cellspacing: 0, "role": "presentation"},
            TBODY({"role": "list", "aria-label": $STR("net.label.Source")},
                TR({"class": "netInfoPostSourceTitle", "role": "presentation"},
                    TD({colspan: 2, "role": "presentation"},
                        DIV({"class": "netInfoPostSource"},
                            $STR("net.label.Source")
                        )
                    )
                )
            )
        ),

    sourceBodyTag:
        TR({"role": "presentation"},
            TD({colspan: 2, "role": "presentation"},
                FOR("line", "$param|getParamValueIterator",
                    CODE({"class":"focusRow subFocusRow" , "role": "listitem"},"$line")
                )
            )
        ),

    getParamValueIterator: function(param)
    {
        return NetInfoBody.getParamValueIterator(param);
    },

    render: function(context, parentNode, file)
    {
        //debugger;
        let spy = getAncestorByClass(parentNode, "spyHead");
        let spyObject = spy.repObject;
        let data = spyObject.data;
        
        ///let contentType = Utils.findHeader(file.requestHeaders, "content-type");
        let contentType = file.mimeType;
        
        ///let text = Utils.getPostText(file, context, true);
        ///if (text == undefined)
        ///    return;

        ///if (Utils.isURLEncodedRequest(file, context))
        // fake Utils.isURLEncodedRequest identification
        if (contentType && contentType == "application/x-www-form-urlencoded" ||
            data && data.indexOf("=") != -1) 
        {
            ///let lines = text.split("\n");
            ///let params = parseURLEncodedText(lines[lines.length-1]);
            let params = parseURLEncodedTextArray(data);
            if (params)
                this.insertParameters(parentNode, params);
        }

        ///if (Utils.isMultiPartRequest(file, context))
        ///{
        ///    let data = this.parseMultiPartText(file, context);
        ///    if (data)
        ///        this.insertParts(parentNode, data);
        ///}

        // moved to the top
        ///let contentType = Utils.findHeader(file.requestHeaders, "content-type");

        ///if (Firebug.JSONViewerModel.isJSON(contentType))
        let jsonData = {
            responseText: data
        };
        
        if (Firebug.JSONViewerModel.isJSON(contentType, data))
            ///this.insertJSON(parentNode, file, context);
            this.insertJSON(parentNode, jsonData, context);

        ///if (Firebug.XMLViewerModel.isXML(contentType))
        ///    this.insertXML(parentNode, file, context);

        ///let postText = Utils.getPostText(file, context);
        ///postText = Utils.formatPostText(postText);
        let postText = data;
        if (postText)
            this.insertSource(parentNode, postText);
    },

    insertParameters: function(parentNode, params)
    {
        if (!params || !params.length)
            return;

        let paramTable = this.paramsTable.append({object:{}}, parentNode);
        let row = $$(".netInfoPostParamsTitle", paramTable)[0];
        //let paramTable = this.paramsTable.append(null, parentNode);
        //let row = paramTable.getElementsByClassName("netInfoPostParamsTitle").item(0);
        
        let tbody = paramTable.getElementsByTagName("tbody")[0];
        
        NetInfoBody.headerDataTag.insertRows({headers: params}, row);
    },

    insertParts: function(parentNode, data)
    {
        if (!data.params || !data.params.length)
            return;

        let partsTable = this.partsTable.append({object:{}}, parentNode);
        let row = $$(".netInfoPostPartsTitle", paramTable)[0];
        //let partsTable = this.partsTable.append(null, parentNode);
        //let row = partsTable.getElementsByClassName("netInfoPostPartsTitle").item(0);

        NetInfoBody.headerDataTag.insertRows({headers: data.params}, row);
    },

    insertJSON: function(parentNode, file, context)
    {
        ///let text = Utils.getPostText(file, context);
        let text = file.responseText;
        ///let data = parseJSONString(text, "http://" + file.request.originalURI.host);
        let data = parseJSONString(text);
        if (!data)
            return;

        ///let jsonTable = this.jsonTable.append(null, parentNode);
        let jsonTable = this.jsonTable.append({}, parentNode);
        ///let jsonBody = jsonTable.getElementsByClassName("netInfoPostJSONBody").item(0);
        let jsonBody = $$(".netInfoPostJSONBody", jsonTable)[0];

        if (!this.toggles)
            this.toggles = {};

        Firebug.DOMPanel.DirTable.tag.replace(
            {object: data, toggles: this.toggles}, jsonBody);
    },

    insertXML: function(parentNode, file, context)
    {
        let text = Utils.getPostText(file, context);

        let jsonTable = this.xmlTable.append(null, parentNode);
        ///let jsonBody = jsonTable.getElementsByClassName("netInfoPostXMLBody").item(0);
        let jsonBody = $$(".netInfoPostXMLBody", jsonTable)[0];

        Firebug.XMLViewerModel.insertXML(jsonBody, text);
    },

    insertSource: function(parentNode, text)
    {
        let sourceTable = this.sourceTable.append({object:{}}, parentNode);
        let row = $$(".netInfoPostSourceTitle", sourceTable)[0];
        //let sourceTable = this.sourceTable.append(null, parentNode);
        //let row = sourceTable.getElementsByClassName("netInfoPostSourceTitle").item(0);

        let param = {value: [text]};
        this.sourceBodyTag.insertRows({param: param}, row);
    },

    parseMultiPartText: function(file, context)
    {
        let text = Utils.getPostText(file, context);
        if (text == undefined)
            return null;

        FBTrace.sysout("net.parseMultiPartText; boundary: ", text);

        let boundary = text.match(/\s*boundary=\s*(.*)/)[1];

        let divider = "\r\n\r\n";
        let bodyStart = text.indexOf(divider);
        let body = text.substr(bodyStart + divider.length);

        let postData = {};
        postData.mimeType = "multipart/form-data";
        postData.params = [];

        let parts = body.split("--" + boundary);
        for (let i=0; i<parts.length; i++)
        {
            let part = parts[i].split(divider);
            if (part.length != 2)
                continue;

            let m = part[0].match(/\s*name=\"(.*)\"(;|$)/);
            postData.params.push({
                name: (m && m.length > 1) ? m[1] : "",
                value: trim(part[1])
            });
        }

        return postData;
    }
});

let NetInfoPostData = Firebug.NetMonitor.NetInfoPostData;

// ************************************************************************************************


// TODO: xxxpedro net i18n
let $STRP = function(a){return a;};

Firebug.NetMonitor.NetLimit = domplate(Firebug.Rep,
{
    collapsed: true,

    tableTag:
        DIV(
            TABLE({width: "100%", cellpadding: 0, cellspacing: 0},
                TBODY()
            )
        ),

    limitTag:
        TR({"class": "netRow netLimitRow", $collapsed: "$isCollapsed"},
            TD({"class": "netCol netLimitCol", colspan: 6},
                TABLE({cellpadding: 0, cellspacing: 0},
                    TBODY(
                        TR(
                            TD(
                                SPAN({"class": "netLimitLabel"},
                                    $STRP("plural.Limit_Exceeded", [0])
                                )
                            ),
                            TD({style: "width:100%"}),
                            TD(
                                BUTTON({"class": "netLimitButton", title: "$limitPrefsTitle",
                                    onclick: "$onPreferences"},
                                  $STR("LimitPrefs")
                                )
                            ),
                            TD("&nbsp;")
                        )
                    )
                )
            )
        ),

    isCollapsed: function()
    {
        return this.collapsed;
    },

    onPreferences: function(event)
    {
        openNewTab("about:config");
    },

    updateCounter: function(row)
    {
        removeClass(row, "collapsed");

        // Update info within the limit row.
        let limitLabel = row.getElementsByClassName("netLimitLabel").item(0);
        limitLabel.firstChild.nodeValue = $STRP("plural.Limit_Exceeded", [row.limitInfo.totalCount]);
    },

    createTable: function(parent, limitInfo)
    {
        let table = this.tableTag.replace({}, parent);
        let row = this.createRow(table.firstChild.firstChild, limitInfo);
        return [table, row];
    },

    createRow: function(parent, limitInfo)
    {
        let row = this.limitTag.insertRows(limitInfo, parent, this)[0];
        row.limitInfo = limitInfo;
        return row;
    },

    // nsIPrefObserver
    observe: function(subject, topic, data)
    {
        // We're observing preferences only.
        if (topic != "nsPref:changed")
          return;

        if (data.indexOf("net.logLimit") != -1)
            this.updateMaxLimit();
    },

    updateMaxLimit: function()
    {
        let value = Firebug.getPref(Firebug.prefDomain, "net.logLimit");
        maxQueueRequests = value ? value : maxQueueRequests;
    }
});

let NetLimit = Firebug.NetMonitor.NetLimit;

// ************************************************************************************************

Firebug.NetMonitor.ResponseSizeLimit = domplate(Firebug.Rep,
{
    tag:
        DIV({"class": "netInfoResponseSizeLimit"},
            SPAN("$object.beforeLink"),
            A({"class": "objectLink", onclick: "$onClickLink"},
                "$object.linkText"
            ),
            SPAN("$object.afterLink")
        ),

    reLink: /^(.*)<a>(.*)<\/a>(.*$)/,
    append: function(obj, parent)
    {
        let m = obj.text.match(this.reLink);
        return this.tag.append({onClickLink: obj.onClickLink,
            object: {
            beforeLink: m[1],
            linkText: m[2],
            afterLink: m[3]
        }}, parent, this);
    }
});

// ************************************************************************************************
// ************************************************************************************************

Firebug.NetMonitor.Utils =
{
    findHeader: function(headers, name)
    {
        if (!headers)
            return null;

        name = name.toLowerCase();
        for (let i = 0; i < headers.length; ++i)
        {
            let headerName = headers[i].name.toLowerCase();
            if (headerName == name)
                return headers[i].value;
        }
    },

    formatPostText: function(text)
    {
        if (text instanceof XMLDocument)
            return getElementXML(text.documentElement);
        else
            return text;
    },

    getPostText: function(file, context, noLimit)
    {
        if (!file.postText)
        {
            file.postText = readPostTextFromRequest(file.request, context);

            if (!file.postText && context)
                file.postText = readPostTextFromPage(file.href, context);
        }

        if (!file.postText)
            return file.postText;

        let limit = Firebug.netDisplayedPostBodyLimit;
        if (file.postText.length > limit && !noLimit)
        {
            return cropString(file.postText, limit,
                "\n\n... " + $STR("net.postDataSizeLimitMessage") + " ...\n\n");
        }

        return file.postText;
    },

    getResponseText: function(file, context)
    {
        // The response can be also empty string so, check agains "undefined".
        return (typeof(file.responseText) != "undefined")? file.responseText :
            context.sourceCache.loadText(file.href, file.method, file);
    },

    isURLEncodedRequest: function(file, context)
    {
        let text = Utils.getPostText(file, context);
        if (text && text.toLowerCase().indexOf("content-type: application/x-www-form-urlencoded") == 0)
            return true;

        // The header value doesn't have to be always exactly "application/x-www-form-urlencoded",
        // there can be even charset specified. So, use indexOf rather than just "==".
        let headerValue = Utils.findHeader(file.requestHeaders, "content-type");
        if (headerValue && headerValue.indexOf("application/x-www-form-urlencoded") == 0)
            return true;

        return false;
    },

    isMultiPartRequest: function(file, context)
    {
        let text = Utils.getPostText(file, context);
        if (text && text.toLowerCase().indexOf("content-type: multipart/form-data") == 0)
            return true;
        return false;
    },

    getMimeType: function(mimeType, uri)
    {
        if (!mimeType || !(mimeCategoryMap.hasOwnProperty(mimeType)))
        {
            let ext = getFileExtension(uri);
            if (!ext)
                return mimeType;
            else
            {
                let extMimeType = mimeExtensionMap[ext.toLowerCase()];
                return extMimeType ? extMimeType : mimeType;
            }
        }
        else
            return mimeType;
    },

    getDateFromSeconds: function(s)
    {
        let d = new Date();
        d.setTime(s*1000);
        return d;
    },

    getHttpHeaders: function(request, file)
    {
        try
        {
            let http = QI(request, Ci.nsIHttpChannel);
            file.status = request.responseStatus;

            // xxxHonza: is there any problem to do this in requestedFile method?
            file.method = http.requestMethod;
            file.urlParams = parseURLParams(file.href);
            file.mimeType = Utils.getMimeType(request.contentType, request.name);

            if (!file.responseHeaders && Firebug.collectHttpHeaders)
            {
                let requestHeaders = [], responseHeaders = [];

                http.visitRequestHeaders({
                    visitHeader: function(name, value)
                    {
                        requestHeaders.push({name: name, value: value});
                    }
                });
                http.visitResponseHeaders({
                    visitHeader: function(name, value)
                    {
                        responseHeaders.push({name: name, value: value});
                    }
                });

                file.requestHeaders = requestHeaders;
                file.responseHeaders = responseHeaders;
            }
        }
        catch (exc)
        {
            // An exception can be throwed e.g. when the request is aborted and
            // request.responseStatus is accessed.
            if (FBTrace.DBG_ERRORS)
                FBTrace.sysout("net.getHttpHeaders FAILS " + file.href, exc);
        }
    },

    isXHR: function(request)
    {
        try
        {
            let callbacks = request.notificationCallbacks;
            let xhrRequest = callbacks ? callbacks.getInterface(Ci.nsIXMLHttpRequest) : null;
            if (FBTrace.DBG_NET)
                FBTrace.sysout("net.isXHR; " + (xhrRequest != null) + ", " + safeGetName(request));

            return (xhrRequest != null);
        }
        catch (exc)
        {
        }

       return false;
    },

    getFileCategory: function(file)
    {
        if (file.category)
        {
            if (FBTrace.DBG_NET)
                FBTrace.sysout("net.getFileCategory; current: " + file.category + " for: " + file.href, file);
            return file.category;
        }

        if (file.isXHR)
        {
            if (FBTrace.DBG_NET)
                FBTrace.sysout("net.getFileCategory; XHR for: " + file.href, file);
            return file.category = "xhr";
        }

        if (!file.mimeType)
        {
            let ext = getFileExtension(file.href);
            if (ext)
                file.mimeType = mimeExtensionMap[ext.toLowerCase()];
        }

        /*if (FBTrace.DBG_NET)
            FBTrace.sysout("net.getFileCategory; " + mimeCategoryMap[file.mimeType] +
                ", mimeType: " + file.mimeType + " for: " + file.href, file);*/

        if (!file.mimeType)
            return "";

        // Solve cases when charset is also specified, eg "text/html; charset=UTF-8".
        let mimeType = file.mimeType;
        if (mimeType)
            mimeType = mimeType.split(";")[0];

        return (file.category = mimeCategoryMap[mimeType]);
    }
};

let Utils = Firebug.NetMonitor.Utils;

// ************************************************************************************************

//Firebug.registerRep(Firebug.NetMonitor.NetRequestTable);
//Firebug.registerActivableModule(Firebug.NetMonitor);
//Firebug.registerPanel(NetPanel);

Firebug.registerModule(Firebug.NetMonitor);
//Firebug.registerRep(Firebug.NetMonitor.BreakpointRep);

// ************************************************************************************************
}});
