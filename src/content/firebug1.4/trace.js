/* See license.txt for terms of usage */

FBL.FBTrace = {};

(function() {
// ************************************************************************************************

let traceOptions = {
    DBG_TIMESTAMP: 1,
    DBG_INITIALIZE: 1,
    DBG_CHROME: 1,
    DBG_ERRORS: 1,
    DBG_DISPATCH: 1,
    DBG_CSS: 1
};

this.module = null;

this.initialize = function()
{
    if (!this.messageQueue)
        this.messageQueue = [];
    
    for (let name in traceOptions)
        this[name] = traceOptions[name]; 
};

// ************************************************************************************************
// FBTrace API

this.sysout = function()
{
    return this.logFormatted(arguments, "");
};

this.dumpProperties = function(title, object)
{
    return this.logFormatted("dumpProperties() not supported.", "warning");
};

this.dumpStack = function()
{
    return this.logFormatted("dumpStack() not supported.", "warning");
};

this.flush = function(module)
{
    this.module = module;
    
    let queue = this.messageQueue;
    this.messageQueue = [];
    
    for (let i = 0; i < queue.length; ++i)
        this.writeMessage(queue[i][0], queue[i][1], queue[i][2]);
};

this.getPanel = function()
{
    return this.module ? this.module.getPanel() : null;
};

//*************************************************************************************************

this.logFormatted = function(objects, className)
{
    let html = this.DBG_TIMESTAMP ? [getTimestamp(), " | "] : [];
    let length = objects.length;
    
    for (let i = 0; i < length; ++i)
    {
        appendText(" ", html);
        
        let object = objects[i];
        
        if (i == 0)
        {
            html.push("<b>");
            appendText(object, html);
            html.push("</b>");
        }
        else
            appendText(object, html);
    }
    
    return this.logRow(html, className);    
};

this.logRow = function(message, className)
{
    let panel = this.getPanel();
    
    if (panel && panel.panelNode)
        this.writeMessage(message, className);
    else
    {
        this.messageQueue.push([message, className]);
    }
    
    return this.LOG_COMMAND;
};

this.writeMessage = function(message, className)
{
    let container = this.getPanel().containerNode;
    let isScrolledToBottom =
        container.scrollTop + container.offsetHeight >= container.scrollHeight;
    
    this.writeRow.call(this, message, className);
    
    if (isScrolledToBottom)
        container.scrollTop = container.scrollHeight - container.offsetHeight;
};

this.appendRow = function(row)
{
    let container = this.getPanel().panelNode;
    container.appendChild(row);
};

this.writeRow = function(message, className)
{
    let row = this.getPanel().panelNode.ownerDocument.createElement("div");
    row.className = "logRow" + (className ? " logRow-"+className : "");
    row.innerHTML = message.join("");
    this.appendRow(row);
};

//*************************************************************************************************

function appendText(object, html)
{
    html.push(escapeHTML(objectToString(object)));
};

function getTimestamp()
{
    let now = new Date();
    let ms = "" + (now.getMilliseconds() / 1000).toFixed(3);
    ms = ms.substr(2);
    
    return now.toLocaleTimeString() + "." + ms;
};

//*************************************************************************************************

let HTMLtoEntity =
{
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&#39;",
    '"': "&quot;"
};

function replaceChars(ch)
{
    return HTMLtoEntity[ch];
};

function escapeHTML(value)
{
    return (value+"").replace(/[<>&"']/g, replaceChars);
};

//*************************************************************************************************

function objectToString(object)
{
    try
    {
        return object+"";
    }
    catch (exc)
    {
        return null;
    }
};

// ************************************************************************************************
}).apply(FBL.FBTrace);