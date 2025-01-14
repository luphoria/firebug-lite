/* See license.txt for terms of usage */

FBL.ns(function() { with (FBL) {
// ************************************************************************************************

if (Env.Options.disableXHRListener)
    return;

// ************************************************************************************************
// XHRSpy
    
let XHRSpy = function()
{
    this.requestHeaders = [];
    this.responseHeaders = [];
};

XHRSpy.prototype = 
{
    method: null,
    url: null,
    async: null,
    
    xhrRequest: null,
    
    href: null,
    
    loaded: false,
    
    logRow: null,
    
    responseText: null,
    
    requestHeaders: null,
    responseHeaders: null,
    
    sourceLink: null, // {href:"file.html", line: 22}
    
    getURL: function()
    {
        return this.href;
    }
};

// ************************************************************************************************
// XMLHttpRequestWrapper

let XMLHttpRequestWrapper = function(activeXObject)
{
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // XMLHttpRequestWrapper internal letiables
    
    let xhrRequest = typeof activeXObject != "undefined" ?
                activeXObject :
                new _XMLHttpRequest(),
        
        spy = new XHRSpy(),
        
        self = this,
        
        reqType,
        reqUrl,
        reqStartTS;

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // XMLHttpRequestWrapper internal methods
    
    let updateSelfPropertiesIgnore = {
        abort: 1,
        channel: 1,
        getAllResponseHeaders: 1,
        getInterface: 1,
        getResponseHeader: 1,
        mozBackgroundRequest: 1,
        multipart: 1,
        onreadystatechange: 1,
        open: 1,
        send: 1,
        setRequestHeader: 1
    };
    
    let updateSelfProperties = function()
    {
        if (supportsXHRIterator)
        {
            for (let propName in xhrRequest)
            {
                if (propName in updateSelfPropertiesIgnore)
                    continue;
                
                try
                {
                    let propValue = xhrRequest[propName];
                    
                    if (propValue && !isFunction(propValue))
                        self[propName] = propValue;
                }
                catch(E)
                {
                    //console.log(propName, E.message);
                }
            }
        }
        else
        {
            // will fail to read these xhrRequest properties if the request is not completed
            if (xhrRequest.readyState == 4)
            {
                self.status = xhrRequest.status;
                self.statusText = xhrRequest.statusText;
                self.responseText = xhrRequest.responseText;
                self.responseXML = xhrRequest.responseXML;
            }
        }
    };
    
    let updateXHRPropertiesIgnore = {
        channel: 1,
        onreadystatechange: 1,
        readyState: 1,
        responseBody: 1,
        responseText: 1,
        responseXML: 1,
        status: 1,
        statusText: 1,
        upload: 1
    };
    
    let updateXHRProperties = function()
    {
        for (let propName in self)
        {
            if (propName in updateXHRPropertiesIgnore)
                continue;
            
            try
            {
                let propValue = self[propName];
                
                if (propValue && !xhrRequest[propName])
                {
                    xhrRequest[propName] = propValue;
                }
            }
            catch(E)
            {
                //console.log(propName, E.message);
            }
        }
    };
    
    let logXHR = function() 
    {
        let row = Firebug.Console.log(spy, null, "spy", Firebug.Spy.XHR);
        
        if (row)
        {
            setClass(row, "loading");
            spy.logRow = row;
        }
    };
    
    let finishXHR = function() 
    {
        let duration = new Date().getTime() - reqStartTS;
        let success = xhrRequest.status == 200;
        
        let responseHeadersText = xhrRequest.getAllResponseHeaders();
        let responses = responseHeadersText ? responseHeadersText.split(/[\n\r]/) : [];
        let reHeader = /^(\S+):\s*(.*)/;
        
        for (let i=0, l=responses.length; i<l; i++)
        {
            let text = responses[i];
            let match = text.match(reHeader);
            
            if (match)
            {
                let name = match[1];
                let value = match[2];
                
                // update the spy mimeType property so we can detect when to show 
                // custom response viewers (such as HTML, XML or JSON viewer)
                if (name == "Content-Type")
                    spy.mimeType = value;
                
                /*
                if (name == "Last Modified")
                {
                    if (!spy.cacheEntry)
                        spy.cacheEntry = [];
                    
                    spy.cacheEntry.push({
                       name: [name],
                       value: [value]
                    });
                }
                /**/
                
                spy.responseHeaders.push({
                   name: [name],
                   value: [value]
                });
            }
        }
            
        with({
            row: spy.logRow, 
            status: xhrRequest.status == 0 ? 
                        // if xhrRequest.status == 0 then accessing xhrRequest.statusText
                        // will cause an error, so we must handle this case (Issue 3504)
                        "" : xhrRequest.status + " " + xhrRequest.statusText, 
            time: duration,
            success: success
        })
        {
            setTimeout(function(){
                
                spy.responseText = xhrRequest.responseText;
                
                // update row information to avoid "ethernal spinning gif" bug in IE 
                row = row || spy.logRow;
                
                // if chrome document is not loaded, there will be no row yet, so just ignore
                if (!row) return;
                
                // update the XHR representation data
                handleRequestStatus(success, status, time);
                
            },200);
        }
        
        spy.loaded = true;
        /*
        // commented because they are being updated by the updateSelfProperties() function
        self.status = xhrRequest.status;
        self.statusText = xhrRequest.statusText;
        self.responseText = xhrRequest.responseText;
        self.responseXML = xhrRequest.responseXML;
        /**/
        updateSelfProperties();
    };
    
    let handleStateChange = function()
    {
        //Firebug.Console.log(["onreadystatechange", xhrRequest.readyState, xhrRequest.readyState == 4 && xhrRequest.status]);
        
        self.readyState = xhrRequest.readyState;
        
        if (xhrRequest.readyState == 4)
        {
            finishXHR();
            
            xhrRequest.onreadystatechange = function(){};
        }
        
        //Firebug.Console.log(spy.url + ": " + xhrRequest.readyState);
        
        self.onreadystatechange();
    };
    
    // update the XHR representation data
    let handleRequestStatus = function(success, status, time)
    {
        let row = spy.logRow;
        FBL.removeClass(row, "loading");
        
        if (!success)
            FBL.setClass(row, "error");
        
        let item = FBL.$$(".spyStatus", row)[0];
        item.innerHTML = status;
        
        if (time)
        {
            let item = FBL.$$(".spyTime", row)[0];
            item.innerHTML = time + "ms";
        }
    };
    
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // XMLHttpRequestWrapper public properties and handlers
    
    this.readyState = 0;
    
    this.onreadystatechange = function(){};
    
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // XMLHttpRequestWrapper public methods
    
    this.open = function(method, url, async, user, password)
    {
        //Firebug.Console.log("xhrRequest open");
        
        updateSelfProperties();
        
        if (spy.loaded)
            spy = new XHRSpy();
        
        spy.method = method;
        spy.url = url;
        spy.async = async;
        spy.href = url;
        spy.xhrRequest = xhrRequest;
        spy.urlParams = parseURLParamsArray(url);
        
        try
        {
            // xhrRequest.open.apply may not be available in IE
            if (supportsApply)
                xhrRequest.open.apply(xhrRequest, arguments);
            else
                xhrRequest.open(method, url, async, user, password);
        }
        catch(e)
        {
        }
        
        xhrRequest.onreadystatechange = handleStateChange;
        
    };
    
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    
    this.send = function(data)
    {
        //Firebug.Console.log("xhrRequest send");
        spy.data = data;
        
        reqStartTS = new Date().getTime();
        
        updateXHRProperties();
        
        try
        {
            xhrRequest.send(data);
        }
        catch(e)
        {
            // TODO: xxxpedro XHR throws or not?
            //throw e;
        }
        finally
        {
            logXHR();
            
            if (!spy.async)
            {
                self.readyState = xhrRequest.readyState;
                
                // sometimes an error happens when calling finishXHR()
                // Issue 3422: Firebug Lite breaks Google Instant Search
                try
                {
                    finishXHR();
                }
                catch(E)
                {
                }
            }
        }
    };
    
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    
    this.setRequestHeader = function(header, value)
    {
        spy.requestHeaders.push({name: [header], value: [value]});
        return xhrRequest.setRequestHeader(header, value);
    };
    
    
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    
    this.abort = function()
    {
        xhrRequest.abort();
        updateSelfProperties();
        handleRequestStatus(false, "Aborted");
    };
    
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    
    this.getResponseHeader = function(header)
    {
        return xhrRequest.getResponseHeader(header);
    };
    
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    
    this.getAllResponseHeaders = function()
    {
        return xhrRequest.getAllResponseHeaders();
    };
    
    /**/
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // Clone XHR object

    // xhrRequest.open.apply not available in IE and will throw an error in 
    // IE6 by simply reading xhrRequest.open so we must sniff it
    let supportsApply = !isIE6 &&
            xhrRequest && 
            xhrRequest.open && 
            typeof xhrRequest.open.apply != "undefined";
    
    let numberOfXHRProperties = 0;
    for (let propName in xhrRequest)
    {
        numberOfXHRProperties++;
        
        if (propName in updateSelfPropertiesIgnore)
            continue;
        
        try
        {
            let propValue = xhrRequest[propName];
            
            if (isFunction(propValue))
            {
                if (typeof self[propName] == "undefined")
                {
                    this[propName] = (function(name, xhr){
                    
                        return supportsApply ?
                            // if the browser supports apply 
                            function()
                            {
                                return xhr[name].apply(xhr, arguments);
                            }
                            :
                            function(a,b,c,d,e)
                            {
                                return xhr[name](a,b,c,d,e);
                            };
                    
                    })(propName, xhrRequest);
                } 
            }
            else
                this[propName] = propValue;
        }
        catch(E)
        {
            //console.log(propName, E.message);
        }
    }
    
    // IE6 does not support for (let prop in XHR)
    let supportsXHRIterator = numberOfXHRProperties > 0;
    
    /**/
    
    return this;
};

// ************************************************************************************************
// ActiveXObject Wrapper (IE6 only)

let _ActiveXObject;
let isIE6 =  /msie 6/i.test(navigator.appVersion);

if (isIE6)
{
    _ActiveXObject = window.ActiveXObject;
    
    let xhrObjects = " MSXML2.XMLHTTP.5.0 MSXML2.XMLHTTP.4.0 MSXML2.XMLHTTP.3.0 MSXML2.XMLHTTP Microsoft.XMLHTTP ";
    
    window.ActiveXObject = function(name)
    {
        let error = null;
        
        try
        {
            let activeXObject = new _ActiveXObject(name);
        }
        catch(e)
        {
            error = e;
        }
        finally
        {
            if (!error)
            {
                if (xhrObjects.indexOf(" " + name + " ") != -1)
                    return new XMLHttpRequestWrapper(activeXObject);
                else
                    return activeXObject;
            }
            else
                throw error.message;
        }
    };
}

// ************************************************************************************************

// Register the XMLHttpRequestWrapper for non-IE6 browsers
if (!isIE6)
{
    let _XMLHttpRequest = XMLHttpRequest;
    window.XMLHttpRequest = function()
    {
        return new XMLHttpRequestWrapper();
    };
}

// ************************************************************************************************
}});
