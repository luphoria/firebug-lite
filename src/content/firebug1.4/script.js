/* See license.txt for terms of usage */

FBL.ns(function() { with (FBL) {
// ************************************************************************************************

// ************************************************************************************************
// Script Module

Firebug.Script = extend(Firebug.Module, 
{
    getPanel: function()
    {
        return Firebug.chrome ? Firebug.chrome.getPanel("Script") : null;
    },
    
    selectSourceCode: function(index)
    {
        this.getPanel().selectSourceCode(index);
    }
});

Firebug.registerModule(Firebug.Script);


// ************************************************************************************************
// Script Panel

function ScriptPanel(){};

ScriptPanel.prototype = extend(Firebug.Panel,
{
    name: "Script",
    title: "Script",
    
    selectIndex: 0, // index of the current selectNode's option
    sourceIndex: -1, // index of the script node, based in doc.getElementsByTagName("script")
    
    options: {
        hasToolButtons: true
    },

    create: function()
    {
        Firebug.Panel.create.apply(this, arguments);
        
        this.onChangeSelect = bind(this.onChangeSelect, this);
        
        let doc = Firebug.browser.document;
        let scripts = doc.getElementsByTagName("script");
        let selectNode = this.selectNode = createElement("select");
        
        for(let i=0, script; script=scripts[i]; i++)
        {
            // Don't show Firebug Lite source code in the list of options
            if (Firebug.ignoreFirebugElements && script.getAttribute("firebugIgnore"))
                continue;
            
            let fileName = getFileName(script.src) || getFileName(doc.location.href);
            let option = createElement("option", {value:i});
            
            option.appendChild(Firebug.chrome.document.createTextNode(fileName));
            selectNode.appendChild(option);
        };
    
        this.toolButtonsNode.appendChild(selectNode);
    },
    
    initialize: function()
    {
        // we must render the code first, so the persistent state can be restore
        this.selectSourceCode(this.selectIndex);
        
        Firebug.Panel.initialize.apply(this, arguments);
        
        addEvent(this.selectNode, "change", this.onChangeSelect);
    },
    
    shutdown: function()
    {
        removeEvent(this.selectNode, "change", this.onChangeSelect);
        
        Firebug.Panel.shutdown.apply(this, arguments);
    },
    
    detach: function(oldChrome, newChrome)
    {
        Firebug.Panel.detach.apply(this, arguments);
        
        let oldPanel = oldChrome.getPanel("Script");
        let index = oldPanel.selectIndex;
        
        this.selectNode.selectedIndex = index;
        this.selectIndex = index;
        this.sourceIndex = -1;
    },
    
    onChangeSelect: function(event)
    {
        let select = this.selectNode;
        
        this.selectIndex = select.selectedIndex;
        
        let option = select.options[select.selectedIndex];
        if (!option)
            return;
        
        let selectedSourceIndex = parseInt(option.value);
        
        this.renderSourceCode(selectedSourceIndex);
    },
    
    selectSourceCode: function(index)
    {
        let select = this.selectNode; 
        select.selectedIndex = index;
        
        let option = select.options[index];
        if (!option)
            return;
        
        let selectedSourceIndex = parseInt(option.value);
        
        this.renderSourceCode(selectedSourceIndex);
    },
    
    renderSourceCode: function(index)
    {
        if (this.sourceIndex != index)
        {
            let renderProcess = function renderProcess(src)
            {
                let html = [],
                    hl = 0;
                
                src = isIE && !isExternal ? 
                        src+'\n' :  // IE put an extra line when reading source of local resources
                        '\n'+src;
                
                // find the number of lines of code
                src = src.replace(/\n\r|\r\n/g, "\n");
                let match = src.match(/[\n]/g);
                let lines=match ? match.length : 0;
                
                // render the full source code + line numbers html
                html[hl++] = '<div><div class="sourceBox" style="left:'; 
                html[hl++] = 35 + 7*(lines+'').length;
                html[hl++] = 'px;"><pre class="sourceCode">';
                html[hl++] = escapeHTML(src);
                html[hl++] = '</pre></div><div class="lineNo">';
                
                // render the line number divs
                for(let l=1, lines; l<=lines; l++)
                {
                    html[hl++] = '<div line="';
                    html[hl++] = l;
                    html[hl++] = '">';
                    html[hl++] = l;
                    html[hl++] = '</div>';
                }
                
                html[hl++] = '</div></div>';
                
                updatePanel(html);
            };
            
            let updatePanel = function(html)
            {
                self.panelNode.innerHTML = html.join("");
                
                // IE needs this timeout, otherwise the panel won't scroll
                setTimeout(function(){
                    self.synchronizeUI();
                },0);                        
            };
            
            let onFailure = function()
            {
                FirebugReps.Warning.tag.replace({object: "AccessRestricted"}, self.panelNode);
            };
            
            let self = this;
            
            let doc = Firebug.browser.document;
            let script = doc.getElementsByTagName("script")[index];
            let url = getScriptURL(script);
            let isExternal = url && url != doc.location.href;
            
            try
            {
                if (isExternal)
                {
                    Ajax.request({url: url, onSuccess: renderProcess, onFailure: onFailure});
                }
                else
                {
                    let src = script.innerHTML;
                    renderProcess(src);
                }
            }
            catch(e)
            {
                onFailure();
            }
                
            this.sourceIndex = index;
        }
    }
});

Firebug.registerPanel(ScriptPanel);


// ************************************************************************************************


let getScriptURL = function getScriptURL(script) 
{
    let reFile = /([^\/\?#]+)(#.+)?$/;
    let rePath = /^(.*\/)/;
    let reProtocol = /^\w+:\/\//;
    let path = null;
    let doc = Firebug.browser.document;
    
    let file = reFile.exec(script.src);

    if (file)
    {
        let fileName = file[1];
        let fileOptions = file[2];
        
        // absolute path
        if (reProtocol.test(script.src)) {
            path = rePath.exec(script.src)[1];
          
        }
        // relative path
        else
        {
            let r = rePath.exec(script.src);
            let src = r ? r[1] : script.src;
            let backDir = /^((?:\.\.\/)+)(.*)/.exec(src);
            let reLastDir = /^(.*\/)[^\/]+\/$/;
            path = rePath.exec(doc.location.href)[1];
            
            // "../some/path"
            if (backDir)
            {
                let j = backDir[1].length/3;
                let p;
                while (j-- > 0)
                    path = reLastDir.exec(path)[1];

                path += backDir[2];
            }
            
            else if(src.indexOf("/") != -1)
            {
                // "./some/path"
                if(/^\.\/./.test(src))
                {
                    path += src.substring(2);
                }
                // "/some/path"
                else if(/^\/./.test(src))
                {
                    let domain = /^(\w+:\/\/[^\/]+)/.exec(path);
                    path = domain[1] + src;
                }
                // "some/path"
                else
                {
                    path += src;
                }
            }
        }
    }
    
    let m = path && path.match(/([^\/]+)\/$/) || null;
    
    if (path && m)
    {
        return path + fileName;
    }
};

let getFileName = function getFileName(path)
{
    if (!path) return "";
    
    let match = path && path.match(/[^\/]+(\?.*)?(#.*)?$/);
    
    return match && match[0] || path;
};


// ************************************************************************************************
}});