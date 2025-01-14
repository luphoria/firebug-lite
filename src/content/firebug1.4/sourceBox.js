/* See license.txt for terms of usage */

FBL.ns(function() { with (FBL) {


///~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
/// TODO: xxxpedro debugger hack
/// TODO: xxxpedro port to Firebug Lite
Firebug.ActivableModule = Firebug.Module;
Firebug.registerActivableModule = Firebug.registerModule;
Firebug.Panel.isEnabled = function(){return true;};
Firebug.ActivablePanel = Firebug.Panel;
///~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~


// ************************************************************************************************

/**
 * @class Defines the API for SourceBoxDecorator and provides the default implementation.
 * Decorators are passed the source box on construction, called to create the HTML,
 * and called whenever the user scrolls the view.
 */
Firebug.SourceBoxDecorator = function(sourceBox){};

Firebug.SourceBoxDecorator.sourceBoxCounter = 0;

Firebug.SourceBoxDecorator.prototype =
/** @lends Firebug.SourceBoxDecorator */
{
    onSourceBoxCreation: function(sourceBox)
    {
        // allow panel-document unique ids to be generated for lines.
        sourceBox.uniqueId = ++Firebug.SourceBoxDecorator.sourceBoxCounter;
    },
    /* called on a delay after the view port is updated, eg vertical scroll
     * The sourceBox will contain lines from firstRenderedLine to lastRenderedLine
     * The user will be able to see sourceBox.firstViewableLine to sourceBox.lastViewableLine
     */
    decorate: function(sourceBox, sourceFile)
    {
        return;
    },

    /* called once as each line is being rendered.
    * @param lineNo integer 1-maxLineNumbers
    */
    getUserVisibleLineNumber: function(sourceBox, lineNo)
    {
        return lineNo;
    },

    /* call once as each line is being rendered.
    * @param lineNo integer 1-maxLineNumbers
    */
    getLineHTML: function(sourceBox, lineNo)
    {
        let html = escapeForSourceLine(sourceBox.lines[lineNo-1]);

        // If the pref says so, replace tabs by corresponding number of spaces.
        if (Firebug.replaceTabs > 0)
        {
            let space = new Array(Firebug.replaceTabs + 1).join(" ");
            html = html.replace(/\t/g, space);
        }

        return html;
    },

    /*
     * @return a string unique to the sourcebox and line number, valid in getElementById()
     */
    getLineId: function(sourceBox, lineNo)
    {
        return 'sb' + sourceBox.uniqueId + '-L' + lineNo;
    }
};

// ************************************************************************************************

/**
 * @panel Firebug.SourceBoxPanel: Intermediate level class for showing lines of source, eg Script Panel
 * Implements a 'viewport' to render only the lines the user is viewing or has recently viewed.
 * Scroll events or scrollToLine calls are converted to viewableRange line number range.
 * The range of lines is rendered, skipping any that have already been rendered. Then if the
 * new line range overlaps the old line range, done; else delete the old range.
 * That way the lines kept contiguous.
 * The rendering details are delegated to SourceBoxDecorator; each source line may be expanded into
 * more rendered lines.
 */
Firebug.SourceBoxPanel = function() {};

let SourceBoxPanelBase = extend(Firebug.MeasureBox, Firebug.ActivablePanel);
Firebug.SourceBoxPanel = extend(SourceBoxPanelBase,
/** @lends Firebug.SourceBoxPanel */
{
    ///~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    /// TODO: xxxpedro debugger hack
    /// need to refactor the Firebug Lite initialization create/destroy, intitialize/shutodown, initializeUI order of calls
    create: function()
    {
        /// TODO: xxxpedro
        this.onResize =  bind(this.resizer, this);
        this.sourceBoxes = {};
        this.decorator = this.getDecorator();
        
        Firebug.ActivablePanel.create.apply(this, arguments);
        
        /// TODO: xxxpedro containerNode is not part of Firebug API
        this.scrollingElement = this.containerNode;
    },
    
    initialize: function(context, doc)
    {
        /// TODO: xxxpedro - need to refactor the Firebug Lite initialization create/destroy, intitialize/shutodown, initializeUI order of calls
        ///this.onResize =  bind(this.resizer, this);
        ///this.sourceBoxes = {};
        ///this.decorator = this.getDecorator();

        Firebug.ActivablePanel.initialize.apply(this, arguments);
    },

    initializeNode: function(panelNode)
    {
        // TODO: xxxpedro
        // since in Firebug Lite each Panel does not have an unique window for its
        // content, we must listen to the Firebug.chrome.window instead in order to
        // handle the resizing of the Panel's UI
        this.resizeEventTarget = Firebug.chrome.window;
        addEvent(this.resizeEventTarget, "resize", this.onResize);
        ///this.resizeEventTarget = Firebug.chrome.$('fbContentBox');
        ///this.resizeEventTarget.addEventListener("resize", this.onResize, true);
        this.attachToCache();

        Firebug.ActivablePanel.initializeNode.apply(this, arguments);
    },

    reattach: function(doc)
    {
        let oldEventTarget = this.resizeEventTarget;
        oldEventTarget.removeEventListener("resize", this.onResize, true);
        Firebug.Panel.reattach.apply(this, arguments);
        
        // TODO: xxxpedro
        this.resizeEventTarget = Firebug.chrome.window;
        addEvent(this.resizeEventTarget, "resize", this.onResize);
        ///this.resizeEventTarget = Firebug.chrome.$('fbContentBox');
        ///this.resizeEventTarget.addEventListener("resize", this.onResize, true);
        this.attachToCache();
    },

    destroyNode: function()
    {
        Firebug.ActivablePanel.destroyNode.apply(this, arguments);
        
        removeEvent(this.resizeEventTarget, "resize", this.onResize);
        ///this.resizeEventTarget.removeEventListener("resize", this.onResize, true);
        this.detachFromCache();
    },

    attachToCache: function()
    {
        this.context.sourceCache.addListener(this);
    },

    detachFromCache: function()
    {
        this.context.sourceCache.removeListener(this);
    },

    onTextSizeChange: function(zoom)
    {
        this.removeAllSourceBoxes();  // clear so we start fresh with new text sizes
    },

    removeAllSourceBoxes: function()
    {
          this.sourceBoxes = {};
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    //  TabCache listener implementation

    onStartRequest: function(context, request)
    {

    },

    onStopRequest: function(context, request, responseText)
    {
        if (context === this.context)
        {
            let url = request.URI.spec;
            let sourceFile = getSourceFileByHref(url, context);
            if (sourceFile)
                this.removeSourceBoxBySourceFile(sourceFile);
        }
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    /**
     * Panel extension point.
     * Called just before box is shown
     */
    updateSourceBox: function(sourceBox)
    {

    },

    /* Panel extension point. Called on panel initialization
     * @return Must implement SourceBoxDecorator API.
     */
    getDecorator: function()
    {
        return new Firebug.SourceBoxDecorator();
    },

     /* Panel extension point
      * @return string eg "js" or "css"
      */
    getSourceType: function()
    {
        throw "SourceBox.getSourceType: Need to override in extender ";
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    disablePanel: function(module)
    {
        this.sourceBoxes = {};  // clear so we start fresh if enabled
        Firebug.ActivablePanel.disablePanel.apply(this, arguments);
    },

    getSourceLinesFrom: function(selection)
    {
        // https://developer.mozilla.org/en/DOM/Selection
        if (selection.isCollapsed)
            return "";

        let anchorSourceRow = getAncestorByClass(selection.anchorNode, "sourceRow");
        let focusSourceRow = getAncestorByClass(selection.focusNode, "sourceRow");
        if (anchorSourceRow == focusSourceRow)
        {
            return selection.toString();// trivial case
        }
        let buf = this.getSourceLine(anchorSourceRow, selection.anchorOffset);

        let currentSourceRow = anchorSourceRow.nextSibling;
        while(currentSourceRow && (currentSourceRow != focusSourceRow) && hasClass(currentSourceRow, "sourceRow"))
        {
            buf += this.getSourceLine(currentSourceRow);
            currentSourceRow = currentSourceRow.nextSibling;
        }
        buf += this.getSourceLine(focusSourceRow, 0, selection.focusOffset);
        return buf;
    },

    getSourceLine: function(sourceRow, beginOffset, endOffset)
    {
        let source = getChildByClass(sourceRow, "sourceRowText").textContent;
        if (endOffset)
            source = source.substring(beginOffset, endOffset);
        else if (beginOffset)
            source = source.substring(beginOffset);
        else
            source = source;

        return source;
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    getSourceBoxBySourceFile: function(sourceFile)
    {
        if (sourceFile.href)
        {
            let sourceBox = this.getSourceBoxByURL(sourceFile.href);
            if (sourceBox && sourceBox.repObject == sourceFile)
                return sourceBox;
            else
                return null;  // cause a new one to be created
        }
    },

    getSourceBoxByURL: function(url)
    {
        return url ? this.sourceBoxes[url] : null;
    },

    removeSourceBoxBySourceFile: function(sourceFile)
    {
        let sourceBox = this.getSourceBoxBySourceFile(sourceFile);
        if (sourceBox)  // else we did not create one for this sourceFile
        {
            delete this.sourceBoxes[sourceFile.href];

            if (sourceBox.parentNode === this.panelNode)
                this.panelNode.removeChild(sourceBox);

            if (this.selectedSourceBox === sourceBox) // need to update the view
            {
                delete this.selectedSourceBox;
                delete this.location;
                this.showSourceFile(sourceFile);
            }
        }
    },

    renameSourceBox: function(oldURL, newURL)
    {
        let sourceBox = this.sourceBoxes[oldURL];
        if (sourceBox)
        {
            delete this.sourceBoxes[oldURL];
            this.sourceBoxes[newURL] = sourceBox;
        }
    },

    showSourceFile: function(sourceFile)
    {
        let sourceBox = this.getSourceBoxBySourceFile(sourceFile);
        if (FBTrace.DBG_SOURCEFILES)
            FBTrace.sysout("firebug.showSourceFile: "+sourceFile, sourceBox);
        if (!sourceBox)
        {
            // Has the script tag mutation event arrived?
            if (sourceFile.compilation_unit_type === "scriptTagAppend" && !sourceFile.source)
            {
                // prevent recursion, just give message if it does not arrive
                sourceFile.source = ["script tag mutation event has not arrived"];
                return;
            }
            sourceBox = this.createSourceBox(sourceFile);
        }


        this.showSourceBox(sourceBox);
    },

    /*
     * Assumes that locations are sourceFiles, TODO lower class
     */
    showSourceLink: function(sourceLink)
    {
        let sourceFile = getSourceFileByHref(sourceLink.href, this.context);
        if (sourceFile)
        {
            this.navigate(sourceFile);
            if (sourceLink.line)
            {
                this.scrollToLine(sourceLink.href, sourceLink.line, this.jumpHighlightFactory(sourceLink.line, this.context));
                dispatch(this.fbListeners, "onShowSourceLink", [this, sourceLink.line]);
            }
            if (sourceLink == this.selection)  // then clear it so the next link will scroll and highlight.
                delete this.selection;
        }
    },

    showSourceBox: function(sourceBox)
    {
        if (this.selectedSourceBox)
            collapse(this.selectedSourceBox, true);

        this.selectedSourceBox = sourceBox;
        delete this.currentSearch;

        if (sourceBox)
        {
            this.reView(sourceBox);
            this.updateSourceBox(sourceBox);
            collapse(sourceBox, false);
        }
    },

    /* Private, do not call outside of this object
    * A sourceBox is a div with additional operations and state.
    * @param sourceFile there is at most one sourceBox for each sourceFile
    */
    createSourceBox: function(sourceFile)  // decorator(sourceFile, sourceBox)
    {
        let sourceBox = this.initializeSourceBox(sourceFile);

        sourceBox.decorator = this.decorator;

        // Framework connection
        sourceBox.decorator.onSourceBoxCreation(sourceBox);

        this.sourceBoxes[sourceFile.href] = sourceBox;

        if (FBTrace.DBG_SOURCEFILES)
            FBTrace.sysout("firebug.createSourceBox with "+sourceBox.maximumLineNumber+" lines for "+sourceFile+(sourceFile.href?" sourceBoxes":" anon "), sourceBox);

        this.panelNode.appendChild(sourceBox);
        this.setSourceBoxLineSizes(sourceBox);

        return sourceBox;
    },

    getSourceFileBySourceBox: function(sourceBox)
    {
        return sourceBox.repObject;
    },

    initializeSourceBox: function(sourceFile)
    {
        let sourceBox = this.document.createElement("div");
        setClass(sourceBox, "sourceBox");
        collapse(sourceBox, true);

        let lines = sourceFile.loadScriptLines(this.context);
        if (!lines)
        {
            lines = ["Failed to load source for sourceFile "+sourceFile];
        }

        sourceBox.lines = lines;
        sourceBox.repObject = sourceFile;

        sourceBox.maximumLineNumber = lines.length;
        sourceBox.maxLineNoChars = (sourceBox.maximumLineNumber + "").length;

        sourceBox.getLineNode =  function(lineNo)
        {
            // XXXjjb this method is supposed to return null if the lineNo is not in the viewport
            return $(this.decorator.getLineId(this, lineNo), this.ownerDocument);
        };

        let paddedSource =
            "<div class='topSourcePadding'>" +
                "<div class='sourceRow'><div class='sourceLine'></div><div class='sourceRowText'></div></div>"+
            "</div>"+
            "<div class='sourceViewport'></div>"+
            "<div class='bottomSourcePadding'>"+
                "<div class='sourceRow'><div class='sourceLine'></div><div class='sourceRowText'></div></div>"+
            "</div>";

        appendInnerHTML(sourceBox, paddedSource);

        sourceBox.viewport = getChildByClass(sourceBox, 'sourceViewport');
        return sourceBox;
    },

    setSourceBoxLineSizes: function(sourceBox)
    {
        let view = sourceBox.viewport;

        let lineNoCharsSpacer = "";
        for (let i = 0; i < sourceBox.maxLineNoChars; i++)
              lineNoCharsSpacer += "0";

        this.startMeasuring(view);
        let size = this.measureText(lineNoCharsSpacer);
        this.stopMeasuring();

        sourceBox.lineHeight = size.height + 1;
        sourceBox.lineNoWidth = size.width;

        view = sourceBox.viewport; // TODO some cleaner way
        view.previousSibling.firstChild.firstChild.style.width = sourceBox.lineNoWidth + "px";
        view.nextSibling.firstChild.firstChild.style.width = sourceBox.lineNoWidth +"px";

        if (FBTrace.DBG_SOURCEFILES)
        {
            FBTrace.sysout("setSourceBoxLineSizes size for lineNoCharsSpacer "+lineNoCharsSpacer, size);
            FBTrace.sysout("firebug.setSourceBoxLineSizes, this.scrollingElement.scrollTop "+this.scrollingElement.scrollTop+ " sourceBox.lineHeight: "+sourceBox.lineHeight+" sourceBox.lineNoWidth:"+sourceBox.lineNoWidth+"\n");
        }
    },

    /*
     * @return SourceLink to currently selected source file
     */
    getSourceLink: function(lineNo)
    {
        if (!this.selectedSourceBox)
            return;
        if (!lineNo)
            lineNo = this.getCentralLine(this.selectedSourceBox);
        return new SourceLink(this.selectedSourceBox.repObject.href, lineNo, this.getSourceType());
    },

    /* Select sourcebox with href, scroll lineNo into center, highlight lineNo with highlighter given
     * @param href a URL, null means the selected sourcefile
     * @param lineNo integer 1-maximumLineNumber
     * @param highlighter callback, a function(sourceBox). sourceBox.centralLine will be lineNo
     */
    scrollToLine: function(href, lineNo, highlighter)
    {
        if (FBTrace.DBG_SOURCEFILES)
            FBTrace.sysout("SourceBoxPanel.scrollToLine: "+lineNo+"@"+href+" with highlighter "+highlighter, highlighter);

        if (this.context.scrollTimeout)
        {
            this.context.clearTimeout(this.context.scrollTimeout);
            delete this.context.scrollTimeout;
        }

        if (href)
        {
            if (!this.selectedSourceBox || this.selectedSourceBox.repObject.href != href)
            {
                let sourceFile = this.context.sourceFileMap[href];
                if (!sourceFile)
                {
                    if(FBTrace.DBG_SOURCEFILES)
                        FBTrace.sysout("scrollToLine FAILS, no sourceFile for href "+href, this.context.sourceFileMap);
                    return;
                }
                this.navigate(sourceFile);
            }
        }

        this.context.scrollTimeout = this.context.setTimeout(bindFixed(function()
        {
            if (!this.selectedSourceBox)
            {
                if (FBTrace.DBG_SOURCEFILES)
                    FBTrace.sysout("SourceBoxPanel.scrollTimeout no selectedSourceBox");
                return;
            }

            this.selectedSourceBox.targetedLine = lineNo;

            // At this time we know which sourcebox is selected but the viewport is not selected.
            // We need to scroll, let the scroll handler set the viewport, then highlight any lines visible.
            let skipScrolling = false;
            if (this.selectedSourceBox.firstViewableLine && this.selectedSourceBox.lastViewableLine)
            {
                let linesFromTop = lineNo - this.selectedSourceBox.firstViewableLine;
                let linesFromBot = this.selectedSourceBox.lastViewableLine - lineNo;
                skipScrolling = (linesFromTop > 3 && linesFromBot > 3);
                if (FBTrace.DBG_SOURCEFILES) FBTrace.sysout("SourceBoxPanel.scrollTimeout: skipScrolling: "+skipScrolling+" fromTop:"+linesFromTop+" fromBot:"+linesFromBot);
            }
            else  // the selectedSourceBox has not been built
            {
                if (FBTrace.DBG_SOURCEFILES)
                    FBTrace.sysout("SourceBoxPanel.scrollTimeout, no viewable lines", this.selectedSourceBox);
            }

            if (!skipScrolling)
            {
                let viewRange = this.getViewRangeFromTargetLine(this.selectedSourceBox, lineNo);
                this.selectedSourceBox.newScrollTop = this.getScrollTopFromViewRange(this.selectedSourceBox, viewRange);
                if (FBTrace.DBG_SOURCEFILES) FBTrace.sysout("SourceBoxPanel.scrollTimeout: newScrollTop "+this.selectedSourceBox.newScrollTop+" vs old "+this.selectedSourceBox.scrollTop+" for "+this.selectedSourceBox.repObject.href);
                this.selectedSourceBox.scrollTop = this.selectedSourceBox.newScrollTop; // *may* cause scrolling
                if (FBTrace.DBG_SOURCEFILES) FBTrace.sysout("SourceBoxPanel.scrollTimeout: scrollTo "+lineNo+" scrollTop:"+this.selectedSourceBox.scrollTop+ " lineHeight: "+this.selectedSourceBox.lineHeight);
            }

            if (this.selectedSourceBox.highlighter)
                this.applyDecorator(this.selectedSourceBox); // may need to highlight even if we don't scroll

        }, this));

        this.selectedSourceBox.highlighter = highlighter;  // clears if null
    },

    /*
     * @return a highlighter function(sourceBox) that puts a class on the line for a time slice
     */
    jumpHighlightFactory: function(lineNo, context)
    {
        return function jumpHighlightIfInView(sourceBox)
        {
            let  lineNode = sourceBox.getLineNode(lineNo);
            if (lineNode)
            {
                setClassTimed(lineNode, "jumpHighlight", context);
                if (FBTrace.DBG_SOURCEFILES)
                    FBTrace.sysout("jumpHighlightFactory on line "+lineNo+" lineNode:"+lineNode.innerHTML+"\n");
            }
            else
            {
                if (FBTrace.DBG_SOURCEFILES)
                    FBTrace.sysout("jumpHighlightFactory no node at line "+lineNo, sourceBox);
            }

            return false; // not sticky
        };
    },

    /*
     * resize and scroll event handler
     */
    resizer: function(event)
    {
        // The resize target is Firebug as a whole. But most of the UI needs no special code for resize.
        // But our SourceBoxPanel has viewport that will change size.
        if (this.selectedSourceBox && this.visible)
        {
            if (FBTrace.DBG_SOURCEFILES)
                FBTrace.sysout("resizer event: "+event.type, event);

            this.reView(this.selectedSourceBox);
        }
    },

    reView: function(sourceBox, clearCache)  // called for all scroll events, including any time this.scrollingElement.scrollTop is set
    {
        let viewRange;
        if (sourceBox.targetedLine)
        {
            sourceBox.targetLineNumber = sourceBox.targetedLine;
            viewRange = this.getViewRangeFromTargetLine(sourceBox, sourceBox.targetedLine);
            delete sourceBox.targetedLine;
        }
        else
        {
            viewRange = this.getViewRangeFromScrollTop(sourceBox, this.scrollingElement.scrollTop);
        }

        if (clearCache)
        {
            this.clearSourceBox(sourceBox);
        }
        else if (this.scrollingElement.scrollTop === sourceBox.lastScrollTop && sourceBox.clientHeight && sourceBox.clientHeight === sourceBox.lastClientHeight)
        {
            if (sourceBox.firstRenderedLine <= viewRange.firstLine && sourceBox.lastRenderedLine >= viewRange.lastLine)
            {
                if (FBTrace.DBG_SOURCEFILES)
                    FBTrace.sysout("reView skipping sourceBox "+this.scrollingElement.scrollTop+"=scrollTop="+sourceBox.lastScrollTop+", "+ sourceBox.clientHeight+"=clientHeight="+sourceBox.lastClientHeight, sourceBox);
                // skip work if nothing changes.
                return;
            }
        }

        dispatch(this.fbListeners, "onBeforeViewportChange", [this]);  // XXXjjb TODO where should this be?
        this.buildViewAround(sourceBox, viewRange);

        if (Firebug.uiListeners.length > 0)
        {
            let link = new SourceLink(sourceBox.repObject.href, sourceBox.centralLine, this.getSourceType());
            dispatch(Firebug.uiListeners, "onViewportChange", [link]);
        }

        sourceBox.lastScrollTop = this.scrollingElement.scrollTop;
        sourceBox.lastClientHeight = sourceBox.clientHeight;
    },

    buildViewAround: function(sourceBox, viewRange)
    {
        try
        {
            this.updateViewportCache(sourceBox, viewRange);
        }
        catch(exc)
        {
            if(FBTrace.DBG_ERRORS)
                FBTrace.sysout("buildViewAround updateViewportCache FAILS "+exc, exc);
        }

        this.setViewportPadding(sourceBox, viewRange);

        sourceBox.centralLine = Math.floor( (viewRange.lastLine + viewRange.firstLine)/2 );

        this.applyDecorator(sourceBox);

        return;
    },

    updateViewportCache: function(sourceBox, viewRange)
    {
        let cacheHit = this.insertedLinesOverlapCache(sourceBox, viewRange);

        if (!cacheHit)
        {
            this.clearSourceBox(sourceBox);  // no overlap, remove old range
            sourceBox.firstRenderedLine = viewRange.firstLine; // reset cached range
            sourceBox.lastRenderedLine = viewRange.lastLine;
        }
        else  // cache overlap, expand range of cache
        {
            sourceBox.firstRenderedLine = Math.min(viewRange.firstLine, sourceBox.firstRenderedLine);
            sourceBox.lastRenderedLine = Math.max(viewRange.lastLine, sourceBox.lastRenderedLine);
        }
        sourceBox.firstViewableLine = viewRange.firstLine;  // todo actually check that these are viewable
        sourceBox.lastViewableLine = viewRange.lastLine;
        sourceBox.numberOfRenderedLines = sourceBox.lastRenderedLine - sourceBox.firstRenderedLine + 1;

        if (FBTrace.DBG_SOURCEFILES)
            FBTrace.sysout("buildViewAround viewRange: "+viewRange.firstLine+"-"+viewRange.lastLine+" rendered: "+sourceBox.firstRenderedLine+"-"+sourceBox.lastRenderedLine, sourceBox);
    },

    /*
     * Add lines from viewRange, but do not adjust first/lastRenderedLine.
     * @return true if viewRange overlaps first/lastRenderedLine
     */
    insertedLinesOverlapCache: function(sourceBox, viewRange)
    {
        let cacheHit = false;
        
        let linesBefore = []; // lines to be prepended
        let linesAfter = []; // lines to be appended
    
        for (let line = viewRange.firstLine; line <= viewRange.lastLine; line++)
        {
            if (line >= sourceBox.firstRenderedLine && line <= sourceBox.lastRenderedLine )
            {
                cacheHit = true;
                continue;
            }

            let lineHTML = this.getSourceLineHTML(sourceBox, line);

            if (line < sourceBox.firstRenderedLine)
            {
                // if we are above the cache, queue lines to be prepended
                linesBefore.push(lineHTML);
            }
            else
            {
                // if we are below the cache, queue lines to be appended
                linesAfter.push(lineHTML);
            }
        }
        
        if (linesBefore.length > 0)
        {
            let topCacheLine = sourceBox.getLineNode(sourceBox.firstRenderedLine);
            
            // prepend all lines at once
            appendInnerHTML(sourceBox.viewport, linesBefore.join(""), topCacheLine);
        }
        
        if (linesAfter.length > 0)
        {
            // append all lines at once
            appendInnerHTML(sourceBox.viewport, linesAfter.join(""), null);
        }
        
        return cacheHit;
    },

    old_insertedLinesOverlapCache: function(sourceBox, viewRange)
    {
        let topCacheLine = null;
        let cacheHit = false;
        for (let line = viewRange.firstLine; line <= viewRange.lastLine; line++)
        {
            if (line >= sourceBox.firstRenderedLine && line <= sourceBox.lastRenderedLine )
            {
                cacheHit = true;
                continue;
            }

            let lineHTML = this.getSourceLineHTML(sourceBox, line);

            let ref = null;
            if (line < sourceBox.firstRenderedLine)   // prepend if we are above the cache
            {
                if (!topCacheLine)
                    topCacheLine = sourceBox.getLineNode(sourceBox.firstRenderedLine);
                ref = topCacheLine;
            }

            let newElement = appendInnerHTML(sourceBox.viewport, lineHTML, ref);
        }
        return cacheHit;
    },

    clearSourceBox: function(sourceBox)
    {
        if (sourceBox.firstRenderedLine)
        {
            let topMostCachedElement = sourceBox.getLineNode(sourceBox.firstRenderedLine);  // eg 1
            let totalCached = sourceBox.lastRenderedLine - sourceBox.firstRenderedLine + 1;   // eg 20 - 1 + 1 = 19
            if (topMostCachedElement && totalCached)
                this.removeLines(sourceBox, topMostCachedElement, totalCached);
        }
        sourceBox.lastRenderedLine = 0;
        sourceBox.firstRenderedLine = 0;
        sourceBox.numberOfRenderedLines = 0;
    },

    getSourceLineHTML: function(sourceBox, i)
    {
        let lineNo = sourceBox.decorator.getUserVisibleLineNumber(sourceBox, i);
        let lineHTML = sourceBox.decorator.getLineHTML(sourceBox, i);
        let lineId = sourceBox.decorator.getLineId(sourceBox, i);    // decorator lines may not have ids

        let lineNoText = this.getTextForLineNo(lineNo, sourceBox.maxLineNoChars);

        let theHTML =
            '<div '
               + (lineId ? ('id="' + lineId + '"') : "")
               + ' class="sourceRow" role="presentation"><a class="'
               +  'sourceLine' + '" role="presentation">'
               + lineNoText
               + '</a><span class="sourceRowText" role="presentation">'
               + lineHTML
               + '</span></div>';

        return theHTML;
    },

    getTextForLineNo: function(lineNo, maxLineNoChars)
    {
        // Make sure all line numbers are the same width (with a fixed-width font)
        let lineNoText = lineNo + "";
        while (lineNoText.length < maxLineNoChars)
            lineNoText = " " + lineNoText;

        return lineNoText;
    },

    removeLines: function(sourceBox, firstRemoval, totalRemovals)
    {
        for(let i = 1; i <= totalRemovals; i++)
        {
            let nextSourceLine = firstRemoval;
            firstRemoval = firstRemoval.nextSibling;
            sourceBox.viewport.removeChild(nextSourceLine);
        }
    },

    getCentralLine: function(sourceBox)
    {
        return sourceBox.centralLine;
    },

    getViewRangeFromTargetLine: function(sourceBox, targetLineNumber)
    {
        let viewRange = {firstLine: 1, centralLine: targetLineNumber, lastLine: 1};

        let averageLineHeight = this.getAverageLineHeight(sourceBox);
        let panelHeight = this.panelNode.clientHeight;
        let linesPerViewport = Math.round((panelHeight / averageLineHeight) + 1);

        viewRange.firstLine = Math.round(targetLineNumber - linesPerViewport / 2);

        if (viewRange.firstLine <= 0)
            viewRange.firstLine = 1;

        viewRange.lastLine = viewRange.firstLine + linesPerViewport;

        if (viewRange.lastLine > sourceBox.maximumLineNumber)
            viewRange.lastLine = sourceBox.maximumLineNumber;

        return viewRange;
    },

    /*
     * Use the average height of source lines in the cache to estimate where the scroll bar points based on scrollTop
     */
    getViewRangeFromScrollTop: function(sourceBox, scrollTop)
    {
        let viewRange = {};
        let averageLineHeight = this.getAverageLineHeight(sourceBox);
        viewRange.firstLine = Math.floor(scrollTop / averageLineHeight + 1);

        /// TODO: xxxpedro
        // In Firebug Lite the "scroll container" is not the panelNode, but its parent.
        let panelHeight = this.panelNode.parentNode.clientHeight;
        ///let panelHeight = this.panelNode.clientHeight;
        let viewableLines = Math.ceil((panelHeight / averageLineHeight) + 1);
        viewRange.lastLine = viewRange.firstLine + viewableLines;
        if (viewRange.lastLine > sourceBox.maximumLineNumber)
            viewRange.lastLine = sourceBox.maximumLineNumber;

        viewRange.centralLine = Math.floor((viewRange.lastLine - viewRange.firstLine)/2);

        if (FBTrace.DBG_SOURCEFILES)
        {
            FBTrace.sysout("getViewRangeFromScrollTop scrollTop:"+scrollTop+" viewRange: "+viewRange.firstLine+"-"+viewRange.lastLine);
            if (!this.noRecurse)
            {
                this.noRecurse = true;
                let testScrollTop = this.getScrollTopFromViewRange(sourceBox, viewRange);
                delete this.noRecurse;
                FBTrace.sysout("getViewRangeFromScrollTop "+((scrollTop==testScrollTop)?"checks":(scrollTop+"=!scrollTop!="+testScrollTop)));
            }
        }

        return viewRange;
    },

    /*
     * inverse of the getViewRangeFromScrollTop.
     * If the viewRange was set by targetLineNumber, then this value become the new scroll top
     *    else the value will be the same as the scrollbar's given value of scrollTop.
     */
    getScrollTopFromViewRange: function(sourceBox, viewRange)
    {
        let averageLineHeight = this.getAverageLineHeight(sourceBox);
        let scrollTop = Math.floor(averageLineHeight * (viewRange.firstLine - 1));

        if (FBTrace.DBG_SOURCEFILES)
        {
            FBTrace.sysout("getScrollTopFromViewRange viewRange:"+viewRange.firstLine+"-"+viewRange.lastLine+" averageLineHeight: "+averageLineHeight+" scrollTop "+scrollTop);
            if (!this.noRecurse)
            {
                this.noRecurse = true;
                let testViewRange = this.getViewRangeFromScrollTop(sourceBox, scrollTop);
                delete this.noRecurse;
                let vrStr = viewRange.firstLine+"-"+viewRange.lastLine;
                let tvrStr = testViewRange.firstLine+"-"+testViewRange.lastLine;
                FBTrace.sysout("getScrollTopFromCenterLine "+((vrStr==tvrStr)? "checks" : vrStr+"=!viewRange!="+tvrStr));
            }
        }

        return scrollTop;
    },

    /*
     * The virtual sourceBox height is the averageLineHeight * max lines
     * @return float
     */
    getAverageLineHeight: function(sourceBox)
    {
        let averageLineHeight = sourceBox.lineHeight;  // fall back to single line height

        let renderedViewportHeight = sourceBox.viewport.clientHeight;
        let numberOfRenderedLines = sourceBox.numberOfRenderedLines;
        if (renderedViewportHeight && numberOfRenderedLines)
            averageLineHeight = renderedViewportHeight / numberOfRenderedLines;

        return averageLineHeight;
    },

    /*
     * The virtual sourceBox = topPadding + sourceBox.viewport + bottomPadding
     * The viewport grows as more lines are added to the cache
     * The virtual sourceBox height is estimated from the average height lines in the viewport cache
     */
    getTotalPadding: function(sourceBox)
    {
        let numberOfRenderedLines = sourceBox.numberOfRenderedLines;
        if (!numberOfRenderedLines)
            return 0;

        let max = sourceBox.maximumLineNumber;
        let averageLineHeight = this.getAverageLineHeight(sourceBox);
        // total box will be the average line height times total lines
        let virtualSourceBoxHeight = Math.floor(max * averageLineHeight);
        let totalPadding;
        if (virtualSourceBoxHeight < sourceBox.clientHeight)
        {
            let scrollBarHeight = sourceBox.offsetHeight - sourceBox.clientHeight;
            // the total - view-taken-up - scrollbar
            totalPadding = sourceBox.clientHeight - sourceBox.viewport.clientHeight - 1;
        }
        else
            totalPadding = virtualSourceBoxHeight - sourceBox.viewport.clientHeight;

        if (FBTrace.DBG_SOURCEFILES)
            FBTrace.sysout("getTotalPadding clientHeight:"+sourceBox.viewport.clientHeight+"  max: "+max+" gives total padding "+totalPadding);

        return totalPadding;
    },

    setViewportPadding: function(sourceBox, viewRange)
    {
        let firstRenderedLineElement = sourceBox.getLineNode(sourceBox.firstRenderedLine);
        if (!firstRenderedLineElement)
        {
            // It's not an error if the panel is disabled.
            if (FBTrace.DBG_ERRORS && this.isEnabled())
                FBTrace.sysout("setViewportPadding FAILS, no line at "+sourceBox.firstRenderedLine, sourceBox);
            return;
        }

        let firstRenderedLineOffset = firstRenderedLineElement.offsetTop;
        let firstViewRangeElement = sourceBox.getLineNode(viewRange.firstLine);
        let firstViewRangeOffset = firstViewRangeElement.offsetTop;
        let topPadding = this.scrollingElement.scrollTop - (firstViewRangeOffset - firstRenderedLineOffset);
        // Because of rounding when converting from pixels to lines, topPadding can be +/- lineHeight/2, round up
        let averageLineHeight = this.getAverageLineHeight(sourceBox);
        let linesOfPadding = Math.floor( (topPadding + averageLineHeight)/ averageLineHeight);
        topPadding = (linesOfPadding - 1)* averageLineHeight;

        if (FBTrace.DBG_SOURCEFILES)
            FBTrace.sysout("setViewportPadding this.scrollingElement.scrollTop - (firstViewRangeOffset - firstRenderedLineOffset): "+this.scrollingElement.scrollTop+"-"+"("+firstViewRangeOffset+"-"+firstRenderedLineOffset+")="+topPadding);
        // we want the bottomPadding to take up the rest
        let totalPadding = this.getTotalPadding(sourceBox);
        let bottomPadding;
        if (totalPadding < 0)
            bottomPadding = Math.abs(totalPadding);
        else
            bottomPadding = Math.floor(totalPadding - topPadding);

        if (bottomPadding < 0)
            bottomPadding = 0;

        if(FBTrace.DBG_SOURCEFILES)
        {
            FBTrace.sysout("setViewportPadding viewport.offsetHeight: "+sourceBox.viewport.offsetHeight+" viewport.clientHeight "+sourceBox.viewport.clientHeight);
            FBTrace.sysout("setViewportPadding sourceBox.offsetHeight: "+sourceBox.offsetHeight+" sourceBox.clientHeight "+sourceBox.clientHeight);
            FBTrace.sysout("setViewportPadding scrollTop: "+this.scrollingElement.scrollTop+" firstRenderedLine "+sourceBox.firstRenderedLine+" bottom: "+bottomPadding+" top: "+topPadding);
        }
        let view = sourceBox.viewport;

        // Set the size on the line number field so the padding is filled with same style as source lines.
        view.previousSibling.style.height = topPadding + "px";
        view.nextSibling.style.height = bottomPadding + "px";

        //sourceRow
        view.previousSibling.firstChild.style.height = topPadding + "px";
        view.nextSibling.firstChild.style.height = bottomPadding + "px";

        //sourceLine
        view.previousSibling.firstChild.firstChild.style.height = topPadding + "px";
        view.nextSibling.firstChild.firstChild.style.height = bottomPadding + "px";
    },

    applyDecorator: function(sourceBox)
    {
        if (this.context.sourceBoxDecoratorTimeout)
        {
            this.context.clearTimeout(this.context.sourceBoxDecoratorTimeout);
            delete this.context.sourceBoxDecoratorTimeout;
        }

        // Run source code decorating on 150ms timeout, which is bigger than
        // the period in which scroll events are fired. So, if the user is moving
        // scroll-bar thumb (or quickly clicking on scroll-arrows), the source code is
        // not decorated (the timeout cleared by the code above) and the scrolling is fast.
        this.context.sourceBoxDecoratorTimeout = this.context.setTimeout(
            bindFixed(this.asyncDecorating, this, sourceBox), 150);

        if (this.context.sourceBoxHighlighterTimeout)
        {
            this.context.clearTimeout(this.context.sourceBoxHighlighterTimeout);
            delete this.context.sourceBoxHighlighterTimeout;
        }

        // Source code highlighting is using different timeout: 0ms. When searching
        // within the Script panel, the user expects immediate response.
        this.context.sourceBoxHighlighterTimeout = this.context.setTimeout(
            bindFixed(this.asyncHighlighting, this, sourceBox));
    },

    asyncDecorating: function(sourceBox)
    {
        try
        {
            sourceBox.decorator.decorate(sourceBox, sourceBox.repObject);

            if (Firebug.uiListeners.length > 0)
                dispatch(Firebug.uiListeners, "onApplyDecorator", [sourceBox]);

            if (FBTrace.DBG_SOURCEFILES)
                FBTrace.sysout("sourceBoxDecoratorTimeout "+sourceBox.repObject, sourceBox);
        }
        catch (exc)
        {
            if (FBTrace.DBG_ERRORS)
                FBTrace.sysout("sourcebox applyDecorator FAILS "+exc, exc);
        }
    },

    asyncHighlighting: function(sourceBox)
    {
        try
        {
            if (sourceBox.highlighter)
            {
                let sticky = sourceBox.highlighter(sourceBox);
                if (FBTrace.DBG_SOURCEFILES)
                    FBTrace.sysout("asyncHighlighting highlighter sticky:"+sticky,
                        sourceBox.highlighter);

                if (!sticky)
                    delete sourceBox.highlighter;
            }
        }
        catch (exc)
        {
            if (FBTrace.DBG_ERRORS)
                FBTrace.sysout("sourcebox highlighter FAILS "+exc, exc);
        }
    }
});

// ************************************************************************************************
}});
