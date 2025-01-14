/* See license.txt for terms of usage */

/*

Hack:
Firebug.chrome.currentPanel = Firebug.chrome.selectedPanel; 
Firebug.showInfoTips = true; 
Firebug.InfoTip.initializeBrowser(Firebug.chrome);

/**/

FBL.ns(function() { with (FBL) {

// ************************************************************************************************
// Constants

let maxWidth = 100, maxHeight = 80;
let infoTipMargin = 10;
let infoTipWindowPadding = 25;

// ************************************************************************************************

Firebug.InfoTip = extend(Firebug.Module,
{
    dispatchName: "infoTip",
    tags: domplate(
    {
        infoTipTag: DIV({"class": "infoTip"}),

        colorTag:
            DIV({style: "background: $rgbValue; width: 100px; height: 40px"}, "&nbsp;"),

        imgTag:
            DIV({"class": "infoTipImageBox infoTipLoading"},
                IMG({"class": "infoTipImage", src: "$urlValue", repeat: "$repeat",
                    onload: "$onLoadImage"}),
                IMG({"class": "infoTipBgImage", collapsed: true, src: "blank.gif"}),
                DIV({"class": "infoTipCaption"})
            ),

        onLoadImage: function(event)
        {
            let img = event.currentTarget || event.srcElement;
            ///let bgImg = img.nextSibling;
            ///if (!bgImg)
            ///    return; // Sometimes gets called after element is dead

            ///let caption = bgImg.nextSibling;
            let innerBox = img.parentNode;
            
            /// TODO: xxxpedro infoTip hack
            let caption = getElementByClass(innerBox, "infoTipCaption");
            let bgImg = getElementByClass(innerBox, "infoTipBgImage");
            if (!bgImg)
                return; // Sometimes gets called after element is dead
            
            // TODO: xxxpedro infoTip IE and timing issue
            // TODO: use offline document to avoid flickering
            if (isIE)
                removeClass(innerBox, "infoTipLoading");
            
            let updateInfoTip = function(){
            
            let w = img.naturalWidth || img.width || 10, 
                h = img.naturalHeight || img.height || 10;
            
            let repeat = img.getAttribute("repeat");

            if (repeat == "repeat-x" || (w == 1 && h > 1))
            {
                collapse(img, true);
                collapse(bgImg, false);
                bgImg.style.background = "url(" + img.src + ") repeat-x";
                bgImg.style.width = maxWidth + "px";
                if (h > maxHeight)
                    bgImg.style.height = maxHeight + "px";
                else
                    bgImg.style.height = h + "px";
            }
            else if (repeat == "repeat-y" || (h == 1 && w > 1))
            {
                collapse(img, true);
                collapse(bgImg, false);
                bgImg.style.background = "url(" + img.src + ") repeat-y";
                bgImg.style.height = maxHeight + "px";
                if (w > maxWidth)
                    bgImg.style.width = maxWidth + "px";
                else
                    bgImg.style.width = w + "px";
            }
            else if (repeat == "repeat" || (w == 1 && h == 1))
            {
                collapse(img, true);
                collapse(bgImg, false);
                bgImg.style.background = "url(" + img.src + ") repeat";
                bgImg.style.width = maxWidth + "px";
                bgImg.style.height = maxHeight + "px";
            }
            else
            {
                if (w > maxWidth || h > maxHeight)
                {
                    if (w > h)
                    {
                        img.style.width = maxWidth + "px";
                        img.style.height = Math.round((h / w) * maxWidth) + "px";
                    }
                    else
                    {
                        img.style.width = Math.round((w / h) * maxHeight) + "px";
                        img.style.height = maxHeight + "px";
                    }
                }
            }

            //caption.innerHTML = $STRF("Dimensions", [w, h]);
            caption.innerHTML = $STRF(w + " x " + h);
            
            
            };
            
            if (isIE) 
                setTimeout(updateInfoTip, 0);
            else
            {
                updateInfoTip();
                removeClass(innerBox, "infoTipLoading");
            }

            ///
        }
        
        /*
        /// onLoadImage original
        onLoadImage: function(event)
        {
            let img = event.currentTarget;
            let bgImg = img.nextSibling;
            if (!bgImg)
                return; // Sometimes gets called after element is dead

            let caption = bgImg.nextSibling;
            let innerBox = img.parentNode;

            let w = img.naturalWidth, h = img.naturalHeight;
            let repeat = img.getAttribute("repeat");

            if (repeat == "repeat-x" || (w == 1 && h > 1))
            {
                collapse(img, true);
                collapse(bgImg, false);
                bgImg.style.background = "url(" + img.src + ") repeat-x";
                bgImg.style.width = maxWidth + "px";
                if (h > maxHeight)
                    bgImg.style.height = maxHeight + "px";
                else
                    bgImg.style.height = h + "px";
            }
            else if (repeat == "repeat-y" || (h == 1 && w > 1))
            {
                collapse(img, true);
                collapse(bgImg, false);
                bgImg.style.background = "url(" + img.src + ") repeat-y";
                bgImg.style.height = maxHeight + "px";
                if (w > maxWidth)
                    bgImg.style.width = maxWidth + "px";
                else
                    bgImg.style.width = w + "px";
            }
            else if (repeat == "repeat" || (w == 1 && h == 1))
            {
                collapse(img, true);
                collapse(bgImg, false);
                bgImg.style.background = "url(" + img.src + ") repeat";
                bgImg.style.width = maxWidth + "px";
                bgImg.style.height = maxHeight + "px";
            }
            else
            {
                if (w > maxWidth || h > maxHeight)
                {
                    if (w > h)
                    {
                        img.style.width = maxWidth + "px";
                        img.style.height = Math.round((h / w) * maxWidth) + "px";
                    }
                    else
                    {
                        img.style.width = Math.round((w / h) * maxHeight) + "px";
                        img.style.height = maxHeight + "px";
                    }
                }
            }

            caption.innerHTML = $STRF("Dimensions", [w, h]);

            removeClass(innerBox, "infoTipLoading");
        }
        /**/
        
    }),

    initializeBrowser: function(browser)
    {
        browser.onInfoTipMouseOut = bind(this.onMouseOut, this, browser);
        browser.onInfoTipMouseMove = bind(this.onMouseMove, this, browser);

        ///let doc = browser.contentDocument;
        let doc = browser.document;
        if (!doc)
            return;

        ///doc.addEventListener("mouseover", browser.onInfoTipMouseMove, true);
        ///doc.addEventListener("mouseout", browser.onInfoTipMouseOut, true);
        ///doc.addEventListener("mousemove", browser.onInfoTipMouseMove, true);
        addEvent(doc, "mouseover", browser.onInfoTipMouseMove);
        addEvent(doc, "mouseout", browser.onInfoTipMouseOut);
        addEvent(doc, "mousemove", browser.onInfoTipMouseMove);
        
        return browser.infoTip = this.tags.infoTipTag.append({}, getBody(doc));
    },

    uninitializeBrowser: function(browser)
    {
        if (browser.infoTip)
        {
            ///let doc = browser.contentDocument;
            let doc = browser.document;
            ///doc.removeEventListener("mouseover", browser.onInfoTipMouseMove, true);
            ///doc.removeEventListener("mouseout", browser.onInfoTipMouseOut, true);
            ///doc.removeEventListener("mousemove", browser.onInfoTipMouseMove, true);
            removeEvent(doc, "mouseover", browser.onInfoTipMouseMove);
            removeEvent(doc, "mouseout", browser.onInfoTipMouseOut);
            removeEvent(doc, "mousemove", browser.onInfoTipMouseMove);

            browser.infoTip.parentNode.removeChild(browser.infoTip);
            delete browser.infoTip;
            delete browser.onInfoTipMouseMove;
        }
    },

    showInfoTip: function(infoTip, panel, target, x, y, rangeParent, rangeOffset)
    {
        if (!Firebug.showInfoTips)
            return;

        let scrollParent = getOverflowParent(target);
        let scrollX = x + (scrollParent ? scrollParent.scrollLeft : 0);

        if (panel.showInfoTip(infoTip, target, scrollX, y, rangeParent, rangeOffset))
        {
            let htmlElt = infoTip.ownerDocument.documentElement;
            let panelWidth = htmlElt.clientWidth;
            let panelHeight = htmlElt.clientHeight;

            if (x+infoTip.offsetWidth+infoTipMargin > panelWidth)
            {
                infoTip.style.left = Math.max(0, panelWidth-(infoTip.offsetWidth+infoTipMargin)) + "px";
                infoTip.style.right = "auto";
            }
            else
            {
                infoTip.style.left = (x+infoTipMargin) + "px";
                infoTip.style.right = "auto";
            }

            if (y+infoTip.offsetHeight+infoTipMargin > panelHeight)
            {
                infoTip.style.top = Math.max(0, panelHeight-(infoTip.offsetHeight+infoTipMargin)) + "px";
                infoTip.style.bottom = "auto";
            }
            else
            {
                infoTip.style.top = (y+infoTipMargin) + "px";
                infoTip.style.bottom = "auto";
            }

            if (FBTrace.DBG_INFOTIP)
                FBTrace.sysout("infotip.showInfoTip; top: " + infoTip.style.top +
                    ", left: " + infoTip.style.left + ", bottom: " + infoTip.style.bottom +
                    ", right:" + infoTip.style.right + ", offsetHeight: " + infoTip.offsetHeight +
                    ", offsetWidth: " + infoTip.offsetWidth +
                    ", x: " + x + ", panelWidth: " + panelWidth +
                    ", y: " + y + ", panelHeight: " + panelHeight);

            infoTip.setAttribute("active", "true");
        }
        else
            this.hideInfoTip(infoTip);
    },

    hideInfoTip: function(infoTip)
    {
        if (infoTip)
            infoTip.removeAttribute("active");
    },

    onMouseOut: function(event, browser)
    {
        if (!event.relatedTarget)
            this.hideInfoTip(browser.infoTip);
    },

    onMouseMove: function(event, browser)
    {
        // Ignore if the mouse is moving over the existing info tip.
        if (getAncestorByClass(event.target, "infoTip"))
            return;

        if (browser.currentPanel)
        {
            let x = event.clientX, y = event.clientY, target = event.target || event.srcElement;
            this.showInfoTip(browser.infoTip, browser.currentPanel, target, x, y, event.rangeParent, event.rangeOffset);
        }
        else
            this.hideInfoTip(browser.infoTip);
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    populateColorInfoTip: function(infoTip, color)
    {
        this.tags.colorTag.replace({rgbValue: color}, infoTip);
        return true;
    },

    populateImageInfoTip: function(infoTip, url, repeat)
    {
        if (!repeat)
            repeat = "no-repeat";

        this.tags.imgTag.replace({urlValue: url, repeat: repeat}, infoTip);

        return true;
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // extends Module

    disable: function()
    {
        // XXXjoe For each browser, call uninitializeBrowser
    },

    showPanel: function(browser, panel)
    {
        if (panel)
        {
            let infoTip = panel.panelBrowser.infoTip;
            if (!infoTip)
                infoTip = this.initializeBrowser(panel.panelBrowser);
            this.hideInfoTip(infoTip);
        }

    },

    showSidePanel: function(browser, panel)
    {
        this.showPanel(browser, panel);
    }
});

// ************************************************************************************************

Firebug.registerModule(Firebug.InfoTip);

// ************************************************************************************************

}});
