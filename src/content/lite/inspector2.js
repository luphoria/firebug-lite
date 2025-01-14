/* See license.txt for terms of usage */

FBL.ns(function() { with (FBL) {

// ************************************************************************************************
// Constants

const inspectDelay = 100;

const edgeSize = 2;

const defaultPrimaryPanel = "html";
const defaultSecondaryPanel = "dom";

let highlightCSS = "chrome://firebug/content/highlighter.css";

// ************************************************************************************************
// Globals

let boxModelHighlighter = null;
let frameHighlighter = null;
let popupHighlighter = null;

// ************************************************************************************************

Firebug.Inspector = extend(Firebug.Module,
{
    inspecting: false,

    highlightObject: function(element, context, highlightType, boxFrame)
    {
        if (!element || !isElement(element) || !isVisible(element))
            element = null;

        if (element && context && context.highlightTimeout)
        {
            context.clearTimeout(context.highlightTimeout);
            delete context.highlightTimeout;
        }

        let highlighter = highlightType ? getHighlighter(highlightType) : this.defaultHighlighter;

        let oldContext = this.highlightedContext;
        if (oldContext && highlighter != this.highlighter)
        {
            if (oldContext.window)
                this.highlighter.unhighlight(oldContext);
        }

        this.highlighter = highlighter;
        this.highlightedElement = element;
        this.highlightedContext = context;

        if (element)
        {
            if (context && context.window && context.window.document)
                highlighter.highlight(context, element, boxFrame);
        }
        else if (oldContext)
        {
            oldContext.highlightTimeout = oldContext.setTimeout(function()
            {
                delete oldContext.highlightTimeout;
                if (oldContext.window && oldContext.window.document)
                    highlighter.unhighlight(oldContext);
            }, inspectDelay);
        }
    },

    toggleInspecting: function(context)
    {
        if (this.inspecting)
            this.stopInspecting(true);
        else
            this.startInspecting(context);
    },

    startInspecting: function(context)
    {
        if (this.inspecting || !context || !context.loaded)
            return;

        this.inspecting = true;
        this.inspectingContext = context;

        context.chrome.setGlobalAttribute("cmd_toggleInspecting", "checked", "true");
        this.attachInspectListeners(context);

        // Remember the previous panel and bar state so we can revert if the user cancels
        this.previousPanelName = context.panelName;
        this.previousSidePanelName = context.sidePanelName;
        this.previouslyCollapsed = $("fbContentBox").collapsed;
        this.previouslyFocused = context.detached && context.chrome.isFocused();

        let htmlPanel = context.chrome.selectPanel("html");
        this.previousObject = htmlPanel.selection;

        if (context.detached)
            FirebugChrome.focus();
        else
            Firebug.showBar(true);

        htmlPanel.panelNode.focus();
        htmlPanel.startInspecting();

        if (context.hoverNode)
            this.inspectNode(context.hoverNode);
    },

    inspectNode: function(node)
    {
        if (node && node.nodeType != 1)
            node = node.parentNode;

        if (node && node.firebugIgnore)
            return;

        let context = this.inspectingContext;

        if (this.inspectTimeout)
        {
            context.clearTimeout(this.inspectTimeout);
            delete this.inspectTimeout;
        }

        this.highlightObject(node, context, "frame");

        this.inspectingNode = node;

        if (node)
        {
            this.inspectTimeout = context.setTimeout(function()
            {
                // TODO: xxxpedro
                //if (context.chrome)
                //    context.chrome.select(node);
            }, inspectDelay);
        }
    },

    stopInspecting: function(cancelled, waitForClick)
    {
        if (!this.inspecting)
            return;

        let context = this.inspectingContext;

        if (this.inspectTimeout)
        {
            context.clearTimeout(this.inspectTimeout);
            delete this.inspectTimeout;
        }

        this.detachInspectListeners(context);
        if (!waitForClick)
            this.detachClickInspectListeners(context.window);

        context.chrome.setGlobalAttribute("cmd_toggleInspecting", "checked", "false");

        this.inspecting = false;

        let htmlPanel = context.getPanel("html");

        if (this.previouslyFocused)
            context.chrome.focus();

        if (cancelled)
        {
            if (this.previouslyCollapsed)
                Firebug.showBar(false);

            if (this.previousPanelName == "html")
                context.chrome.select(this.previousObject);
            else
                context.chrome.selectPanel(this.previousPanelName, this.previousSidePanelName);
        }
        else
        {
            context.chrome.select(htmlPanel.selection);
            context.chrome.getSelectedPanel().panelNode.focus();
        }

        htmlPanel.stopInspecting(htmlPanel.selection, cancelled);

        this.inspectNode(null);

        delete this.previousObject;
        delete this.previousPanelName;
        delete this.previousSidePanelName;
        delete this.inspectingContext;
    },

    inspectNodeBy: function(dir)
    {
        let target;
        let node = this.inspectingNode;

        if (dir == "up")
            target = this.inspectingContext.chrome.getNextObject();
        else if (dir == "down")
        {
            target = this.inspectingContext.chrome.getNextObject(true);
            if (node && !target)
            {
                if (node.contentDocument)
                    target = node.contentDocument.documentElement;
                else
                    target = getNextElement(node.firstChild);
            }
        }

        if (target && isElement(target))
            this.inspectNode(target);
        else
            beep();
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    attachInspectListeners: function(context)
    {
        let win = context.window;
        if (!win || !win.document)
            return;

        let chrome = context.chrome;
        if (!chrome)
            chrome = FirebugChrome;

        this.keyListeners =
        [
            chrome.keyCodeListen("RETURN", null, bindFixed(this.stopInspecting, this)),
            chrome.keyCodeListen("ESCAPE", null, bindFixed(this.stopInspecting, this, true)),
            chrome.keyCodeListen("UP", isControl, bindFixed(this.inspectNodeBy, this, "up"), true),
            chrome.keyCodeListen("DOWN", isControl, bindFixed(this.inspectNodeBy, this, "down"), true),
        ];

        iterateWindows(win, bind(function(subWin)
        {
            subWin.document.addEventListener("mouseover", this.onInspectingMouseOver, true);
            subWin.document.addEventListener("mousedown", this.onInspectingMouseDown, true);
            subWin.document.addEventListener("click", this.onInspectingClick, true);
        }, this));
    },

    detachInspectListeners: function(context)
    {
        let win = context.window;
        if (!win || !win.document)
            return;

        let chrome = context.chrome;
        if (!chrome)
            chrome = FirebugChrome;

        if (this.keyListeners)  // XXXjjb for some reason this is null some times.
        {
            for (let i = 0; i < this.keyListeners.length; ++i)
                chrome.keyIgnore(this.keyListeners[i]);
            delete this.keyListeners;
        }

        iterateWindows(win, bind(function(subWin)
        {
            subWin.document.removeEventListener("mouseover", this.onInspectingMouseOver, true);
            subWin.document.removeEventListener("mousedown", this.onInspectingMouseDown, true);
        }, this));
    },

    detachClickInspectListeners: function(win)
    {
        // We have to remove the click listener in a second phase because if we remove it
        // after the mousedown, we won't be able to cancel clicked links
        iterateWindows(win, bind(function(subWin)
        {
            subWin.document.removeEventListener("click", this.onInspectingClick, true);
        }, this));
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    onInspectingMouseOver: function(event)
    {
        if (FBTrace.DBG_INSPECT)
           FBTrace.dumpEvent("onInspecting event", event);
        this.inspectNode(event.target);
        cancelEvent(event);
    },

    onInspectingMouseDown: function(event)
    {
        if (FBTrace.DBG_INSPECT)
           FBTrace.dumpEvent("onInspecting event", event);
        this.stopInspecting(false, true);
        cancelEvent(event);
    },

    onInspectingClick: function(event)
    {
        if (FBTrace.DBG_INSPECT)
            FBTrace.dumpEvent("onInspecting event", event);
        let win = event.currentTarget.defaultView;
        if (win)
        {
            win = getRootWindow(win);
            this.detachClickInspectListeners(win);
        }
        cancelEvent(event);
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // extends Module

    initialize: function()
    {
        this.onInspectingMouseOver = bind(this.onInspectingMouseOver, this);
        this.onInspectingMouseDown = bind(this.onInspectingMouseDown, this);
        this.onInspectingClick = bind(this.onInspectingClick, this);

        highlightCSS = Env.Location.sourceDir + "firebug/highlighter.css"; 
        this.inspectingContext = Firebug.browser.window;
        //this.updateOption("shadeBoxModel", Firebug.shadeBoxModel);
    },

    initContext: function(context)
    {
        context.onPreInspectMouseOver = function(event) { context.hoverNode = event.target; };
    },

    destroyContext: function(context)
    {
        if (context.highlightTimeout)
        {
            context.clearTimeout(context.highlightTimeout);
            delete context.highlightTimeout;
        }

        if (this.inspecting)
            this.stopInspecting(true);
    },

    watchWindow: function(context, win)
    {
        win.addEventListener("mouseover", context.onPreInspectMouseOver, true);
    },

    unwatchWindow: function(context, win)
    {
        try {
            win.removeEventListener("mouseover", context.onPreInspectMouseOver, true);
        } catch (ex) {
            // Get unfortunate errors here sometimes, so let's just ignore them
            // since the window is going away anyhow
        }
    },

    showContext: function(browser, context)
    {
        if (this.inspecting)
            this.stopInspecting(true);

        if (browser)
        {
            let disabled = !context || !context.loaded;
            browser.chrome.setGlobalAttribute("menu_firebugInspect", "disabled", disabled);
        }
    },

    showPanel: function(browser, panel)
    {
        let chrome = browser.chrome;
        let disabled = !panel || !panel.context.loaded;
        chrome.setGlobalAttribute("cmd_toggleInspecting", "disabled", disabled);
        chrome.setGlobalAttribute("menu_firebugInspect", "disabled", disabled);
    },

    loadedContext: function(context)
    {
        context.chrome.setGlobalAttribute("cmd_toggleInspecting", "disabled", "false");
        context.chrome.setGlobalAttribute("menu_firebugInspect", "disabled", "false");
    },

    updateOption: function(name, value)
    {
        if (name == "shadeBoxModel")
        {
            this.highlightObject(null);
            this.defaultHighlighter = value ? getHighlighter("boxModel") : getHighlighter("frame");
        }
    },

    getObjectByURL: function(context, url)
    {
        let styleSheet = getStyleSheetByHref(url, context);
        if (styleSheet)
            return styleSheet;

        /*let path = getURLPath(url);
        let xpath = "//*[contains(@src, '" + path + "')]";
        let elements = getElementsByXPath(context.window.document, xpath);
        if (elements.length)
            return elements[0];*/
    }
});

// ************************************************************************************************
// Local Helpers

function getHighlighter(type)
{
    if (type == "boxModel")
    {
        if (!boxModelHighlighter)
            boxModelHighlighter = new BoxModelHighlighter();

        return boxModelHighlighter;
    }
    else if (type == "frame")
    {
        if (!frameHighlighter)
            frameHighlighter = new FrameHighlighter();

        return frameHighlighter;
    }
    else if (type == "popup")
    {
        if (!popupHighlighter)
            popupHighlighter = new PopupHighlighter();

        return popupHighlighter;
    }
}

function pad(element, t, r, b, l)
{
    element.style.padding = Math.abs(t) + "px " + Math.abs(r) + "px "
        + Math.abs(b) + "px " + Math.abs(l) + "px";
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

function FrameHighlighter()
{
}

FrameHighlighter.prototype =
{
    highlight: function(context, element)
    {
        // TODO: xxxpedro
        //if (element instanceof XULElement)
        //    return;
        let offset = getViewOffset(element, true);
        let x = offset.x, y = offset.y;
        let w = element.offsetWidth, h = element.offsetHeight;
        if (FBTrace.DBG_INSPECT)
                FBTrace.sysout("FrameHighlighter HTML tag:"+element.tagName,"x:"+x+" y:"+y+" w:"+w+" h:"+h);

        let wacked = isNaN(x) || isNaN(y) || isNaN(w) || isNaN(h);
        if (FBTrace.DBG_INSPECT && wacked)
            FBTrace.sysout("FrameHighlighter.highlight has bad boxObject for ", element.tagName);
        if (wacked)
            return;

        let nodes = this.getNodes(context, element);

        move(nodes.top, x, y-edgeSize);
        resize(nodes.top, w, edgeSize);

        move(nodes.right, x+w, y-edgeSize);
        resize(nodes.right, edgeSize, h+edgeSize*2);

        move(nodes.bottom, x, y+h);
        resize(nodes.bottom, w, edgeSize);

        move(nodes.left, x-edgeSize, y-edgeSize);
        resize(nodes.left, edgeSize, h+edgeSize*2);
        if (FBTrace.DBG_INSPECT)																			/*@explore*/
            FBTrace.sysout("FrameHighlighter ", element.tagName);											/*@explore*/
        let body = getNonFrameBody(element);
        if (!body)
            return this.unhighlight(context);

        let needsAppend = !nodes.top.parentNode || nodes.top.ownerDocument != body.ownerDocument;
        if (needsAppend)
        {
            if (FBTrace.DBG_INSPECT)																		/*@explore*/
                FBTrace.sysout("FrameHighlighter needsAppend", nodes.top.ownerDocument.documentURI+" !?= "+body.ownerDocument.documentURI); /*@explore*/
            attachStyles(context, body);
            for (let edge in nodes)
            {
                try
                {
                    body.appendChild(nodes[edge]);
                }
                catch(exc)
                {
                    if (FBTrace.DBG_INSPECT)                                                                              /*@explore*/
                        FBTrace.dumpProperties("inspector.FrameHighlighter.highlight FAILS", exc);                     /*@explore*/
                }
            }
        }
    },

    unhighlight: function(context)
    {
        if (FBTrace.DBG_INSPECT)
            FBTrace.sysout("FrameHighlighter unhightlight", context.window.location);
        let nodes = this.getNodes(context);
        let body = nodes.top.parentNode;
        if (body)
        {
            for (let edge in nodes)
                body.removeChild(nodes[edge]);
        }
    },

    getNodes: function(context)
    {
        if (!context.frameHighlighter)
        {
            let doc = context.window.document;

            function createEdge(name)
            {
                let div = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
                div.firebugIgnore = true;
                div.className = "firebugHighlight";
                return div;
            }

            context.frameHighlighter =
            {
                top: createEdge("Top"),
                right: createEdge("Right"),
                bottom: createEdge("Bottom"),
                left: createEdge("Left")
            };
        }

        return context.frameHighlighter;
    }
};
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

function PopupHighlighter()
{
}

PopupHighlighter.prototype =
{
    highlight: function(context, element)
    {
        let doc = context.window.document;
        let popup = doc.getElementById("inspectorPopup");
        popup.style.width = "200px";
        popup.style.height = "100px";
        popup.showPopup(element, element.boxObject.screenX,
            element.boxObject.screenY, "popup", "none", "none");
        if (FBTrace.DBG_INSPECT)
        {
            FBTrace.sysout("PopupHighlighter for "+element.tagName, " at ("+element.boxObject.screenX+","+element.boxObject.screenY+")");
            FBTrace.dumpProperties("PopupHighlighter popup=", popup);
        }
    },

    unhighlight: function(context)
    {
    },
}
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

function BoxModelHighlighter()
{
}

BoxModelHighlighter.prototype =
{
    highlight: function(context, element, boxFrame)
    {
        let nodes = this.getNodes(context);
        let highlightFrame = boxFrame ? nodes[boxFrame] : null;

        if (context.highlightFrame)
            removeClass(context.highlightFrame, "firebugHighlightBox");

        context.highlightFrame = highlightFrame;

        if (highlightFrame)
        {
            setClass(nodes.offset, "firebugHighlightGroup");
            setClass(highlightFrame, "firebugHighlightBox");
        }
        else
            removeClass(nodes.offset, "firebugHighlightGroup");

        let win = element.ownerDocument.defaultView;
        if (!win)
            return;

        let offsetParent = element.offsetParent;
        if (!offsetParent)
            return;

        let parentStyle = win.getComputedStyle(offsetParent, "");
        let parentOffset = getViewOffset(offsetParent, true);
        let parentX = parentOffset.x + parseInt(parentStyle.borderLeftWidth);
        let parentY = parentOffset.y + parseInt(parentStyle.borderTopWidth);
        let parentW = offsetParent.offsetWidth-1;
        let parentH = offsetParent.offsetHeight-1;

        let style = win.getComputedStyle(element, "");
        let styles = readBoxStyles(style);

        let offset = getViewOffset(element, true);
        let x = offset.x - Math.abs(styles.marginLeft);
        let y = offset.y - Math.abs(styles.marginTop);
        let w = element.offsetWidth - (styles.paddingLeft + styles.paddingRight
                + styles.borderLeft + styles.borderRight);
        let h = element.offsetHeight - (styles.paddingTop + styles.paddingBottom
                + styles.borderTop + styles.borderBottom);

        move(nodes.offset, x, y);
        pad(nodes.margin, styles.marginTop, styles.marginRight, styles.marginBottom,
                styles.marginLeft);
        pad(nodes.border, styles.borderTop, styles.borderRight, styles.borderBottom,
                styles.borderLeft);
        pad(nodes.padding, styles.paddingTop, styles.paddingRight, styles.paddingBottom,
                styles.paddingLeft);
        resize(nodes.content, w, h);

        let showLines = Firebug.showRulers && boxFrame;
        if (showLines)
        {
            move(nodes.parent, parentX, parentY);
            resize(nodes.parent, parentW, parentH);

            if (parentX < 14)
                setClass(nodes.parent, "overflowRulerX");
            else
                removeClass(nodes.parent, "overflowRulerX");

            if (parentY < 14)
                setClass(nodes.parent, "overflowRulerY");
            else
                removeClass(nodes.parent, "overflowRulerY");

            let left = x;
            let top = y;
            let width = w-1;
            let height = h-1;

            if (boxFrame == "content")
            {
                left += Math.abs(styles.marginLeft) + Math.abs(styles.borderLeft)
                    + Math.abs(styles.paddingLeft);
                top += Math.abs(styles.marginTop) + Math.abs(styles.borderTop)
                    + Math.abs(styles.paddingTop);
            }
            else if (boxFrame == "padding")
            {
                left += Math.abs(styles.marginLeft) + Math.abs(styles.borderLeft);
                top += Math.abs(styles.marginTop) + Math.abs(styles.borderTop);
                width += Math.abs(styles.paddingLeft) + Math.abs(styles.paddingRight);
                height += Math.abs(styles.paddingTop) + Math.abs(styles.paddingBottom);
            }
            else if (boxFrame == "border")
            {
                left += Math.abs(styles.marginLeft);
                top += Math.abs(styles.marginTop);
                width += Math.abs(styles.paddingLeft) + Math.abs(styles.paddingRight)
                     + Math.abs(styles.borderLeft) + Math.abs(styles.borderRight);
                height += Math.abs(styles.paddingTop) + Math.abs(styles.paddingBottom)
                    + Math.abs(styles.borderTop) + Math.abs(styles.borderBottom);
            }
            else if (boxFrame == "margin")
            {
                width += Math.abs(styles.paddingLeft) + Math.abs(styles.paddingRight)
                     + Math.abs(styles.borderLeft) + Math.abs(styles.borderRight)
                     + Math.abs(styles.marginLeft) + Math.abs(styles.marginRight);
                height += Math.abs(styles.paddingTop) + Math.abs(styles.paddingBottom)
                    + Math.abs(styles.borderTop) + Math.abs(styles.borderBottom)
                    + Math.abs(styles.marginTop) + Math.abs(styles.marginBottom);
            }

            move(nodes.lines.top, 0, top);
            move(nodes.lines.right, left+width, 0);
            move(nodes.lines.bottom, 0, top+height);
            move(nodes.lines.left, left, 0)
        }

        let body = getNonFrameBody(element);
        if (!body)
            return this.unhighlight(context);

        let needsAppend = !nodes.offset.parentNode
            || nodes.offset.parentNode.ownerDocument != body.ownerDocument;

        if (needsAppend)
        {
            attachStyles(context, body);
            body.appendChild(nodes.offset);
        }

        if (showLines)
        {
            if (!nodes.lines.top.parentNode)
            {
                body.appendChild(nodes.parent);

                for (let line in nodes.lines)
                    body.appendChild(nodes.lines[line]);
            }
        }
        else if (nodes.lines.top.parentNode)
        {
            body.removeChild(nodes.parent);

            for (let line in nodes.lines)
                body.removeChild(nodes.lines[line]);
        }
    },

    unhighlight: function(context)
    {
        let nodes = this.getNodes(context);
        if (nodes.offset.parentNode)
        {
            let body = nodes.offset.parentNode;
            body.removeChild(nodes.offset);

            if (nodes.lines.top.parentNode)
            {
                body.removeChild(nodes.parent);

                for (let line in nodes.lines)
                    body.removeChild(nodes.lines[line]);
            }
        }
    },

    getNodes: function(context)
    {
        if (!context.boxModelHighlighter)
        {
            let doc = context.window.document;
            if (FBTrace.DBG_ERRORS && !doc) FBTrace.dumpStack("inspector getNodes no document for window:"+window.location);

            function createRuler(name)
            {
                let div = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
                div.firebugIgnore = true;
                div.className = "firebugRuler firebugRuler"+name;
                return div;
            }

            function createBox(name)
            {
                let div = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
                div.firebugIgnore = true;
                div.className = "firebugLayoutBox firebugLayoutBox"+name;
                return div;
            }

            function createLine(name)
            {
                let div = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
                div.firebugIgnore = true;
                div.className = "firebugLayoutLine firebugLayoutLine"+name;
                return div;
            }

            let nodes = context.boxModelHighlighter =
            {
                parent: createBox("Parent"),
                rulerH: createRuler("H"),
                rulerV: createRuler("V"),
                offset: createBox("Offset"),
                margin: createBox("Margin"),
                border: createBox("Border"),
                padding: createBox("Padding"),
                content: createBox("Content"),
                lines: {
                    top: createLine("Top"),
                    right: createLine("Right"),
                    bottom: createLine("Bottom"),
                    left: createLine("Left")
                }
            };

            nodes.parent.appendChild(nodes.rulerH);
            nodes.parent.appendChild(nodes.rulerV);
            nodes.offset.appendChild(nodes.margin);
            nodes.margin.appendChild(nodes.border);
            nodes.border.appendChild(nodes.padding);
            nodes.padding.appendChild(nodes.content);
        }

        return context.boxModelHighlighter;
    }
};

let getNonFrameBody = function getNonFrameBody(elt)
{
    let body = getBody(elt.ownerDocument);
    return body.localName.toUpperCase() == "FRAMESET" ? null : body;
}

let attachStyles = function attachStyles(context, body)
{
    let doc = body.ownerDocument;
    if (!context.highlightStyle)
        context.highlightStyle = createStyleSheet(doc, highlightCSS);

    if (!context.highlightStyle.parentNode || context.highlightStyle.ownerDocument != doc)
        addStyleSheet(body.ownerDocument, context.highlightStyle);
}

// ************************************************************************************************

Firebug.registerModule(Firebug.Inspector);

// ************************************************************************************************

}});
