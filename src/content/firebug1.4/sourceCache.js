/* See license.txt for terms of usage */

FBL.ns(function() { with (FBL) {

// ************************************************************************************************
// Constants

///const Cc = Components.classes;
///const Ci = Components.interfaces;
///const nsIIOService = Ci.nsIIOService;
///const nsIRequest = Ci.nsIRequest;
///const nsICachingChannel = Ci.nsICachingChannel;
///const nsIScriptableInputStream = Ci.nsIScriptableInputStream;
///const nsIUploadChannel = Ci.nsIUploadChannel;
///const nsIHttpChannel = Ci.nsIHttpChannel;

///const IOService = Cc["@mozilla.org/network/io-service;1"];
///const ioService = IOService.getService(nsIIOService);
///const ScriptableInputStream = Cc["@mozilla.org/scriptableinputstream;1"];
///const chromeReg = CCSV("@mozilla.org/chrome/chrome-registry;1", "nsIToolkitChromeRegistry");

///const LOAD_FROM_CACHE = nsIRequest.LOAD_FROM_CACHE;
///const LOAD_BYPASS_LOCAL_CACHE_IF_BUSY = nsICachingChannel.LOAD_BYPASS_LOCAL_CACHE_IF_BUSY;

///const NS_BINDING_ABORTED = 0x804b0002;

// ************************************************************************************************

Firebug.SourceCache = function(context)
{
    this.context = context;
    this.cache = {};
};

Firebug.SourceCache.prototype = extend(new Firebug.Listener(),
{
    isCached: function(url)
    {
        return (this.cache[url] ? true : false);
    },

    loadText: function(url, method, file)
    {
        let lines = this.load(url, method, file);
        return lines ? lines.join("") : null;
    },

    load: function(url, method, file)
    {
        if (FBTrace.DBG_CACHE)
        {
            FBTrace.sysout("sourceCache.load: " + url);

            if (!this.cache.hasOwnProperty(url) && this.cache[url])
                FBTrace.sysout("sourceCache.load; ERROR - hasOwnProperty returns false, " +
                    "but the URL is cached: " + url, this.cache[url]);
        }

        // xxxHonza: sometimes hasOwnProperty return false even if the URL is obviously there.
        //if (this.cache.hasOwnProperty(url))
        let response = this.cache[this.removeAnchor(url)];
        if (response)
            return response;

        if (FBTrace.DBG_CACHE)
        {
            let urls = [];
            for (let prop in this.cache)
                urls.push(prop);

            FBTrace.sysout("sourceCache.load: Not in the Firebug internal cache", urls);
        }

        let d = FBL.splitDataURL(url);  //TODO the RE should not have baseLine
        if (d)
        {
            let src = d.encodedContent;
            let data = decodeURIComponent(src);
            let lines = splitLines(data);
            this.cache[url] = lines;

            return lines;
        }

        let j = FBL.reJavascript.exec(url);
        if (j)
        {
            let src = url.substring(FBL.reJavascript.lastIndex);
            let lines = splitLines(src);
            this.cache[url] = lines;

            return lines;
        }

        let c = FBL.reChrome.test(url);
        if (c)
        {
            if (Firebug.filterSystemURLs)
                return ["Filtered chrome url "+url];  // ignore chrome

            // If the chrome.manifest has  xpcnativewrappers=no, platform munges the url
            let reWrapperMunge = /(\S*)\s*->\s*(\S*)/;
            let m = reWrapperMunge.exec(url);
            if (m)
            {
                url = m[2];
                if (FBTrace.DBG_CACHE)
                    FBTrace.sysout("sourceCache found munged xpcnativewrapper url and set it to "+url+" m "+m+" m[0]:"+m[0]+" [1]"+m[1], m);
            }

            let chromeURI = makeURI(url);
            if (!chromeURI)
            {
                if (FBTrace.DBG_CACHE)
                    FBTrace.sysout("sourceCache.load failed to convert chrome to local: "+url);
                return ["sourceCache failed to make URI from "+url];
            }

            let localURI = chromeReg.convertChromeURL(chromeURI);
            if (FBTrace.DBG_CACHE)
                FBTrace.sysout("sourceCache.load converting chrome to local: "+url, " -> "+localURI.spec);
            return this.loadFromLocal(localURI.spec);
        }

        c = FBL.reFile.test(url);
        if (c)
        {
            return this.loadFromLocal(url);
        }

        // Unfortunately, the URL isn't available so, let's try to use FF cache.
        // Notice that additional network request to the server can be made in
        // this method (double-load).
        return this.loadFromCache(url, method, file);
    },

    store: function(url, text)
    {
        let tempURL = this.removeAnchor(url);

        if (FBTrace.DBG_CACHE)
            FBTrace.sysout("sourceCache for " + this.context.getName() + " store url=" +
                url + ((tempURL != url) ? " -> " + tempURL : ""), text);

        let lines = splitLines(text);
        return this.storeSplitLines(tempURL, lines);
    },

    removeAnchor: function(url)
    {
        let index = url.indexOf("#");
        if (index < 0)
            return url;

        return url.substr(0, index);
    },

    loadFromLocal: function(url)
    {
        // if we get this far then we have either a file: or chrome: url converted to file:
        let src = getResource(url);
        if (src)
        {
            let lines = splitLines(src);
            this.cache[url] = lines;

            return lines;
        }
    },

    loadFromCache: function(url, method, file)
    {
        if (FBTrace.DBG_CACHE) FBTrace.sysout("sourceCache.loadFromCache url:"+url);

        let 
            doc = this.context.window.document,
            charset;
        if (doc)
            charset = doc.characterSet;
        else
            charset = "UTF-8";

        /// TODO: xxxpedro XPCOM
        /*
        let channel;
        try
        {
            channel = ioService.newChannel(url, null, null);
            channel.loadFlags |= LOAD_FROM_CACHE | LOAD_BYPASS_LOCAL_CACHE_IF_BUSY;

            if (method && (channel instanceof nsIHttpChannel))
            {
                let httpChannel = QI(channel, nsIHttpChannel);
                httpChannel.requestMethod = method;
            }
        }
        catch (exc)
        {
            if (FBTrace.DBG_CACHE)
                FBTrace.sysout("sourceCache for url:"+url+" window="+this.context.window.location.href+" FAILS:", exc);
            return;
        }

        if (url == this.context.browser.contentWindow.location.href)
        {
            if (FBTrace.DBG_CACHE) FBTrace.sysout("sourceCache.load content window href\n");
            if (channel instanceof nsIUploadChannel)
            {
                let postData = getPostStream(this.context);
                if (postData)
                {
                    let uploadChannel = QI(channel, nsIUploadChannel);
                    uploadChannel.setUploadStream(postData, "", -1);
                    if (FBTrace.DBG_CACHE) FBTrace.sysout("sourceCache.load uploadChannel set\n");
                }
            }

            if (channel instanceof nsICachingChannel)
            {
                let cacheChannel = QI(channel, nsICachingChannel);
                cacheChannel.cacheKey = getCacheKey(this.context);
                if (FBTrace.DBG_CACHE) FBTrace.sysout("sourceCache.load cacheChannel key"+cacheChannel.cacheKey+"\n");
            }
        }
        else if ((method == "PUT" || method == "POST") && file)
        {
            if (channel instanceof nsIUploadChannel)
            {
                // In case of PUT and POST, don't forget to use the original body.
                let postData = getPostText(file, this.context);
                if (postData)
                {
                    let postDataStream = getInputStreamFromString(postData);
                    let uploadChannel = QI(channel, nsIUploadChannel);
                    uploadChannel.setUploadStream(postDataStream, "application/x-www-form-urlencoded", -1);
                    if (FBTrace.DBG_CACHE) FBTrace.sysout("sourceCache.load uploadChannel set\n");
                }
            }
        }

        let stream;
        try
        {
            if (FBTrace.DBG_CACHE) FBTrace.sysout("sourceCache.load url:"+url+" with charset"+charset+"\n");
            stream = channel.open();
        }
        catch (exc)
        {
            if (FBTrace.DBG_ERRORS)
            {
                let isCache = (channel instanceof nsICachingChannel)?"nsICachingChannel":"NOT caching channel";
                let isUp = (channel instanceof nsIUploadChannel)?"nsIUploadChannel":"NOT nsIUploadChannel";
                FBTrace.sysout(url+" vs "+this.context.browser.contentWindow.location.href+" and "+isCache+" "+isUp+"\n");
                FBTrace.sysout("sourceCache.load fails channel.open for url="+url+ " cause:", exc);
                FBTrace.sysout("sourceCache.load fails channel=", channel);
            }
            return ["sourceCache.load FAILS for url="+url, exc.toString()];
        }
        /**/

        try
        {
            ///let data = readFromStream(stream, charset);
            this.cache[url] = splitLines(Firebug.Lite.Proxy.load(url));
            return this.cache[url];
        }
        catch (exc)
        {
            if (FBTrace.DBG_ERRORS)
                FBTrace.sysout("sourceCache.load FAILS, url="+url, exc);
            return ["sourceCache.load FAILS for url="+url, exc.toString()];
        }
        finally
        {
            ///stream.close();
        }
    },

    storeSplitLines: function(url, lines)
    {
        if (FBTrace.DBG_CACHE)
            FBTrace.sysout("sourceCache for window="+this.context.getName()+" store url="+url+"\n");
        return this.cache[url] = lines;
    },

    invalidate: function(url)
    {
        url = this.removeAnchor(url);

        if (FBTrace.DBG_CACHE)
            FBTrace.sysout("sourceCache.invalidate; " + url);

        delete this.cache[url];
    },

    getLine: function(url, lineNo)
    {
        let lines = this.load(url);
        if (lines)
        {
            if (lineNo <= lines.length)
                return lines[lineNo-1];
            else
                return (lines.length == 1) ? lines[0] : "("+lineNo+" out of range "+lines.length+")";
        }
        else
            return "(no source for "+url+")";
    }
});

let readWithXHR = function(url)
{
    Ajax.request({url: url, async: false});
    return Ajax.transport.responseText;
};

/// TODO: xxxpedro XPCOM
/*
// xxxHonza getPostText and readPostTextFromRequest are copied from
// net.js. These functions should be removed when this cache is
// refactored due to the double-load problem.
function getPostText(file, context)
{
    if (!file.postText)
        file.postText = readPostTextFromPage(file.href, context);

    if (!file.postText)
        file.postText = readPostTextFromRequest(file.request, context);

    return file.postText;
}

// ************************************************************************************************

function getPostStream(context)
{
    try
    {
        let webNav = context.browser.webNavigation;
        let descriptor = QI(webNav, Ci.nsIWebPageDescriptor).currentDescriptor;
        let entry = QI(descriptor, Ci.nsISHEntry);

        if (entry.postData)
        {
            // Seek to the beginning, or it will probably start reading at the end
            let postStream = QI(entry.postData, Ci.nsISeekableStream);
            postStream.seek(0, 0);
            return postStream;
        }
     }
     catch (exc)
     {
     }
}

function getCacheKey(context)
{
    try
    {
        let webNav = context.browser.webNavigation;
        let descriptor = QI(webNav, Ci.nsIWebPageDescriptor).currentDescriptor;
        let entry = QI(descriptor, Ci.nsISHEntry);
        return entry.cacheKey;
     }
     catch (exc)
     {
     }
}
/**/

// ************************************************************************************************
}});
