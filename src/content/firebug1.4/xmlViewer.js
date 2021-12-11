/* See license.txt for terms of usage */

FBL.ns(function() { with (FBL) {

// ************************************************************************************************
// Constants

// List of XML related content types.
let xmlContentTypes =
[
    "text/xml",
    "application/xml",
    "application/xhtml+xml",
    "application/rss+xml",
    "application/atom+xml",,
    "application/vnd.mozilla.maybe.feed",
    "application/rdf+xml",
    "application/vnd.mozilla.xul+xml"
];

// ************************************************************************************************
// Model implementation

/**
 * @module Implements viewer for XML based network responses. In order to create a new
 * tab wihin network request detail, a listener is registered into
 * <code>Firebug.NetMonitor.NetInfoBody</code> object.
 */
Firebug.XMLViewerModel = extend(Firebug.Module,
{
    dispatchName: "xmlViewer",

    initialize: function()
    {
        ///Firebug.ActivableModule.initialize.apply(this, arguments);
        Firebug.Module.initialize.apply(this, arguments);
        Firebug.NetMonitor.NetInfoBody.addListener(this);
    },

    shutdown: function()
    {
        ///Firebug.ActivableModule.shutdown.apply(this, arguments);
        Firebug.Module.shutdown.apply(this, arguments);
        Firebug.NetMonitor.NetInfoBody.removeListener(this);
    },

    /**
     * Check response's content-type and if it's a XML, create a new tab with XML preview.
     */
    initTabBody: function(infoBox, file)
    {
        if (FBTrace.DBG_XMLVIEWER)
            FBTrace.sysout("xmlviewer.initTabBody", infoBox);

        // If the response is XML let's display a pretty preview.
        ///if (this.isXML(safeGetContentType(file.request)))
        if (this.isXML(file.mimeType, file.responseText))
        {
            Firebug.NetMonitor.NetInfoBody.appendTab(infoBox, "XML",
                ///$STR("xmlviewer.tab.XML"));
                $STR("XML"));

            if (FBTrace.DBG_XMLVIEWER)
                FBTrace.sysout("xmlviewer.initTabBody; XML response available");
        }
    },

    isXML: function(contentType)
    {
        if (!contentType)
            return false;

        // Look if the response is XML based.
        for (let i=0; i<xmlContentTypes.length; i++)
        {
            if (contentType.indexOf(xmlContentTypes[i]) == 0)
                return true;
        }

        return false;
    },

    /**
     * Parse XML response and render pretty printed preview.
     */
    updateTabBody: function(infoBox, file, context)
    {
        let tab = infoBox.selectedTab;
        ///let tabBody = infoBox.getElementsByClassName("netInfoXMLText").item(0);
        let tabBody = $$(".netInfoXMLText", infoBox)[0];
        if (!hasClass(tab, "netInfoXMLTab") || tabBody.updated)
            return;

        tabBody.updated = true;

        this.insertXML(tabBody, Firebug.NetMonitor.Utils.getResponseText(file, context));
    },

    insertXML: function(parentNode, text)
    {
        let xmlText = text.replace(/^\s*<?.+?>\s*/, "");
        
        let div = parentNode.ownerDocument.createElement("div");
        div.innerHTML = xmlText;
        
        let root = div.getElementsByTagName("*")[0];
    
        /***
        let parser = CCIN("@mozilla.org/xmlextras/domparser;1", "nsIDOMParser");
        let doc = parser.parseFromString(text, "text/xml");
        let root = doc.documentElement;

        // Error handling
        let nsURI = "http://www.mozilla.org/newlayout/xml/parsererror.xml";
        if (root.namespaceURI == nsURI && root.nodeName == "parsererror")
        {
            this.ParseError.tag.replace({error: {
                message: root.firstChild.nodeValue,
                source: root.lastChild.textContent
            }}, parentNode);
            return;
        }
        /**/

        if (FBTrace.DBG_XMLVIEWER)
            FBTrace.sysout("xmlviewer.updateTabBody; XML response parsed", doc);

        // Override getHidden in these templates. The parsed XML documen is
        // hidden, but we want to display it using 'visible' styling.
        /*
        let templates = [
            Firebug.HTMLPanel.CompleteElement,
            Firebug.HTMLPanel.Element,
            Firebug.HTMLPanel.TextElement,
            Firebug.HTMLPanel.EmptyElement,
            Firebug.HTMLPanel.XEmptyElement,
        ];

        let originals = [];
        for (let i=0; i<templates.length; i++)
        {
            originals[i] = templates[i].getHidden;
            templates[i].getHidden = function() {
                return "";
            }
        }
        /**/

        // Generate XML preview.
        ///Firebug.HTMLPanel.CompleteElement.tag.replace({object: doc.documentElement}, parentNode);
        
        // TODO: xxxpedro html3
        ///Firebug.HTMLPanel.CompleteElement.tag.replace({object: root}, parentNode);
        let html = [];
        Firebug.Reps.appendNode(root, html);
        parentNode.innerHTML = html.join("");
        

        /*
        for (let i=0; i<originals.length; i++)
            templates[i].getHidden = originals[i];/**/
    }
});

// ************************************************************************************************
// Domplate

/**
 * @domplate Represents a template for displaying XML parser errors. Used by
 * <code>Firebug.XMLViewerModel</code>.
 */
Firebug.XMLViewerModel.ParseError = domplate(Firebug.Rep,
{
    tag:
        DIV({"class": "xmlInfoError"},
            DIV({"class": "xmlInfoErrorMsg"}, "$error.message"),
            PRE({"class": "xmlInfoErrorSource"}, "$error|getSource")
        ),

    getSource: function(error)
    {
        let parts = error.source.split("\n");
        if (parts.length != 2)
            return error.source;

        let limit = 50;
        let column = parts[1].length;
        if (column >= limit) {
            parts[0] = "..." + parts[0].substr(column - limit);
            parts[1] = "..." + parts[1].substr(column - limit);
        }

        if (parts[0].length > 80)
            parts[0] = parts[0].substr(0, 80) + "...";

        return parts.join("\n");
    }
});

// ************************************************************************************************
// Registration

Firebug.registerModule(Firebug.XMLViewerModel);

}});
