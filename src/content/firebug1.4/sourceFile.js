/* See license.txt for terms of usage */

FBL.ns(function() { with (FBL) {

///    const Cc = Components.classes;
///    const Ci = Components.interfaces;

///    const PCMAP_SOURCETEXT = Ci.jsdIScript.PCMAP_SOURCETEXT;
///    const PCMAP_PRETTYPRINT = Ci.jsdIScript.PCMAP_PRETTYPRINT;

let PCMAP_SOURCETEXT = -1;
let PCMAP_PRETTYPRINT = -2;


//* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
/*
 * SourceFile one for every compilation unit.
 * Unique URL for each. (href)
 * Unique outerScript, the statements outside of any function defintion
 * sourceCache keyed by href has source for this compilation unit
 * Stored by href in context.
 * Contains array of jsdIScript for functions (scripts) defined in this unit
 * May contain line table (for sources viewed)
 */

Firebug.SourceFile = function (compilation_unit_type)
{
    this.compilation_unit_type = compilation_unit_type; /*@explore*/
};

Firebug.SourceFile.prototype =
{
    getBaseLineOffset: function()
    {
        return 0;
    },

    toString: function()
    {
        let str = (this.compilation_unit_type?this.compilation_unit_type+" ":"")+this.href+" script.tags( ";
        if (this.outerScript)
            str += (this.outerScript.isValid?this.outerScript.tag:"X") +"| ";
        if (this.innerScripts)
        {
            let numberInvalid = 0;
            for (let p in this.innerScripts)
            {
                let script = this.innerScripts[p];
                if (script.isValid)
                    str += p+" ";
                else
                    numberInvalid++;
            }
        }
        str += ")"+(numberInvalid ? "("+numberInvalid+" invalid)" : "");
        return str;
    },

    /*
    forEachScript: function(callback)
     {
         if (this.outerScript)
             callback(this.outerScript);
         if (this.innerScripts)
         {
             for (let p in this.innerScripts)
             {
                 let script = this.innerScripts[p];
                 let rc = callback(script);
                 if (rc)
                     return rc;
             }
         }
     },

     getLineRanges: function()
     {
         let str = "";
         this.forEachScript(function appendARange(script)
         {
             let endLineNumber = script.baseLineNumber + script.lineExtent;
             str += " "+script.baseLineNumber +"-("+script.tag+")-"+endLineNumber;
         });
         return str;
     },

     getSourceLength: function()
     {
             return this.sourceLength;
     },

     getLine: function(context, lineNo)
     {
         return context.sourceCache.getLine(this.href, lineNo);
     },

     addToLineTable: function(script)
     {
         if (!script || !script.isValid)
         {
             if (FBTrace.DBG_ERRORS)
                 FBTrace.sysout("addToLineTable got invalid script "+(script?script.tag:"null")+"\n");
             return;
         }

         // For outer scripts, a better algorithm would loop over PC, use pcToLine to mark the lines.
         // This assumes there are fewer PCs in an outer script than lines, probably true for large systems.
         // And now addToLineTable is only used for outerScripts (eval and top-level).
         // But since we can't know the range of PC values we cannot use that approach.

         if (!this.outerScriptLineMap)
             this.outerScriptLineMap = [];

         let lineCount = script.lineExtent + 1;
         let offset = this.getBaseLineOffset();
         if (FBTrace.DBG_LINETABLE)
         {
             FBTrace.sysout("lib.SourceFile.addToLineTable script.tag:"+script.tag+" lineExtent="+lineCount+" baseLineNumber="+script.baseLineNumber+" offset="+offset+" for "+this.compilation_unit_type+"\n");
             let startTime = new Date().getTime();
         }
         if (lineCount > 100)
             lineCount = 100; // isLineExecutable requires about 1ms per line, so it can only be called for toy programs

         for (let i = 0; i <= lineCount; i++)
         {
             let scriptLineNo = i + script.baseLineNumber;  // the max is (i + script.baseLineNumber + script.lineExtent)
             let mapLineNo = scriptLineNo - offset;
             try
             {
                 if (script.isLineExecutable(scriptLineNo, this.pcmap_type))
                     this.outerScriptLineMap.push(mapLineNo);
             }
             catch (e)
             {
                 // I guess not...
             }

             if (FBTrace.DBG_LINETABLE)
             {
                 let pcFromLine = script.lineToPc(scriptLineNo, this.pcmap_type);
                 let lineFromPC = script.pcToLine(pcFromLine, this.pcmap_type);
                 if (this.outerScriptLineMap.indexOf(mapLineNo) != -1)
                     FBTrace.sysout("lib.SourceFile.addToLineTable ["+mapLineNo+"]="+script.tag+" for scriptLineNo="+scriptLineNo+" vs "+lineFromPC+"=lineFromPC; lineToPc="+pcFromLine+" with map="+(this.pcmap_type==PCMAP_PRETTYPRINT?"PP":"SOURCE")+"\n");
                 else
                     FBTrace.sysout("lib.SourceFile.addToLineTable not executable scriptLineNo="+scriptLineNo+" vs "+lineFromPC+"=lineFromPC; lineToPc="+pcFromLine+"\n");
             }
         }
         if (FBTrace.DBG_LINETABLE)
         {
             let endTime = new Date().getTime();
             let delta = endTime - startTime ;
             if (delta > 0) FBTrace.sysout("SourceFile.addToLineTable processed "+lineCount+" lines in "+delta+" millisecs "+Math.round(lineCount/delta)+" lines per millisecond\n");
             FBTrace.sysout("SourceFile.addToLineTable: "+this.toString()+"\n");
         }
     },

     addToLineTableByPCLoop: function(script)
     {
         // This code is not called; it crashes FF3pre https://bugzilla.mozilla.org/show_bug.cgi?id=430205
         if (!this.outerScriptLineMap)
             this.outerScriptLineMap = {};

         let lineCount = script.lineExtent;
         let offset = this.getBaseLineOffset();
         if (FBTrace.DBG_LINETABLE)
         {
             FBTrace.sysout("lib.SourceFile.addToLineTableByPCLoop script.tag:"+script.tag+" lineCount="+lineCount+" offset="+offset+" for "+this.compilation_unit_type+"\n");
             let startTime = new Date().getTime();
         }

         for (let i = 0; i <= 10*lineCount; i++)
         {
             let lineFromPC = script.pcToLine(i, this.pcmap_type);
             //FBTrace.sysout("lib.SourceFile.addToLineTableByPCLoop pc="+i+" line: "+lineFromPC+"\n");
             this.outerScriptLineMap[lineFromPC] = script;
             if (lineFromPC >= lineCount) break;
         }

         if (FBTrace.DBG_LINETABLE)
         {
             FBTrace.sysout("SourceFile.addToLineTableByPCLoop: "+this.toString()+"\n");
             let endTime = new Date().getTime();
             let delta = endTime - startTime ;
             if (delta > 0) FBTrace.sysout("SourceFileaddToLineTableByPCLoop processed "+lineCount+" lines in "+delta+" millisecs "+Math.round(lineCount/delta)+" lines per millisecond\n");
         }
     },

     hasScriptAtLineNumber: function(lineNo, mustBeExecutableLine)
     {
         let offset = this.getBaseLineOffset();

         if (!this.innerScripts)
             return; // eg URLOnly

         let targetLineNo = lineNo + offset;  // lineNo is user-viewed number, targetLineNo is jsd number

         let scripts = [];
         for (let p in this.innerScripts)
         {
             let script = this.innerScripts[p];
             if (mustBeExecutableLine && !script.isValid)
                continue;

             this.addScriptAtLineNumber(scripts, script, targetLineNo, mustBeExecutableLine, offset);

             if (scripts.length)
                return true;
         }

         if (this.outerScript && !(mustBeExecutableLine && !this.outerScript.isValid) )
             this.addScriptAtLineNumber(scripts, this.outerScript, targetLineNo, mustBeExecutableLine, offset);

         return (scripts.length > 0);
     },

     getScriptsAtLineNumber: function(lineNo, mustBeExecutableLine)
     {
         let offset = this.getBaseLineOffset();

         if (!this.innerScripts)
             return; // eg URLOnly

         let targetLineNo = lineNo + offset;  // lineNo is user-viewed number, targetLineNo is jsd number

         let scripts = [];
         for (let p in this.innerScripts)
         {
             let script = this.innerScripts[p];
             if (mustBeExecutableLine && !script.isValid) continue;
             this.addScriptAtLineNumber(scripts, script, targetLineNo, mustBeExecutableLine, offset);
         }

         if (this.outerScript && !(mustBeExecutableLine && !this.outerScript.isValid) )
             this.addScriptAtLineNumber(scripts, this.outerScript, targetLineNo, mustBeExecutableLine, offset);

         if (FBTrace.DBG_LINETABLE)
         {
             if (scripts.length < 1)
             {
                 FBTrace.sysout("lib.getScriptsAtLineNumber no targetScript at "+lineNo," for sourceFile:"+this.toString());
                 return false;
             }
             else
             {
                 FBTrace.sysout("getScriptsAtLineNumber offset "+offset+" for sourcefile: "+this.toString()+"\n");
             }
         }

         return (scripts.length > 0) ? scripts : false;
     },

     addScriptAtLineNumber: function(scripts, script, targetLineNo, mustBeExecutableLine, offset)
     {
         // script.isValid will be true.
         if (FBTrace.DBG_LINETABLE)
             FBTrace.sysout("addScriptAtLineNumber trying "+script.tag+", is "+script.baseLineNumber+" <= "+targetLineNo +" <= "+ (script.baseLineNumber + script.lineExtent)+"? using offset = "+offset+"\n");

         if (targetLineNo >= script.baseLineNumber)
         {
             if ( (script.baseLineNumber + script.lineExtent) >= targetLineNo)
             {
                 if (mustBeExecutableLine)
                 {
                     try
                     {
                         if (!script.isLineExecutable(targetLineNo, this.pcmap_type) )
                         {
                             if (FBTrace.DBG_LINETABLE)
                                 FBTrace.sysout("getScriptsAtLineNumber tried "+script.tag+", not executable at targetLineNo:"+targetLineNo+" pcmap:"+this.pcmap_type+"\n");
                             return;
                         }
                     }
                     catch (e)
                     {
                         // Component returned failure code: 0x80040111 (NS_ERROR_NOT_AVAILABLE) [jsdIScript.isLineExecutable]
                         return;
                     }
                 }
                 scripts.push(script);
                 if (FBTrace.DBG_LINETABLE)
                 {
                     let checkExecutable = "";
                     if (mustBeExecutableLine)
                         let checkExecutable = " isLineExecutable: "+script.isLineExecutable(targetLineNo, this.pcmap_type)+"@pc:"+script.lineToPc(targetLineNo, this.pcmap_type);
                     FBTrace.sysout("getScriptsAtLineNumber found "+script.tag+", isValid: "+script.isValid+" targetLineNo:"+targetLineNo+checkExecutable+"\n");
                 }
             }
         }
     },

     scriptsIfLineCouldBeExecutable: function(lineNo)  // script may not be valid
     {
         let scripts = this.getScriptsAtLineNumber(lineNo, true);
         if (FBTrace.DBG_LINETABLE && !scripts) FBTrace.sysout("lib.scriptsIfLineCouldBeExecutable this.outerScriptLineMap", this.outerScriptLineMap);
         if (!scripts && this.outerScriptLineMap && (this.outerScriptLineMap.indexOf(lineNo) != -1) )
             return [this.outerScript];
         return scripts;
     },

     /**/
     isExecutableLine: function(lineNo)  // script may not be valid
     {
        /// TODO: xxxpedro sourceFile
        return false;
        
         if (this.hasScriptAtLineNumber(lineNo, true))
            return true;

         if (this.outerScriptLineMap && (this.outerScriptLineMap.indexOf(lineNo) != -1))
             return true;

         return false;
     },

     /*hasScript: function(script)
     {
         if (this.outerScript && (this.outerScript.tag == script.tag) )
             return true;
         // XXXjjb Don't use indexOf or similar tests that rely on ===, since we are really working with
         // wrappers around jsdIScript, not script themselves.  I guess.

        return ( this.innerScripts && this.innerScripts.hasOwnProperty(script.tag) );
     },

     // these objects map JSD's values to correct values
     getScriptAnalyzer: function(script)
     {
         if (script && this.outerScript && (script.tag == this.outerScript.tag) )
             return this.getOuterScriptAnalyzer();
         return new Firebug.SourceFile.NestedScriptAnalyzer(this);
     },

     // return.path: group/category label, return.name: item label
     getObjectDescription: function()
     {
         return FBL.splitURLBase(this.href);
     },

     isEval: function()
     {
         return (this.compilation_unit_type == "eval-level") || (this.compilation_unit_type == "newFunction");
     },

     isEvent: function()
     {
         return (this.compilation_unit_type == "event");
     },

     /**/
     loadScriptLines: function(context)  // array of lines
     {
         if (this.source)
             return this.source;
         else
             return context.sourceCache.load(this.href);
     }/*,

     getOuterScriptAnalyzer: function()
     {
         FBTrace.sysout("getOuterScriptAnalyzer not overridden for "+sourceFile, this);
     }
     /**/

};

Firebug.SourceFile.summarizeSourceLineArray = function(sourceLines, size)
{
    let buf  = "";
    for (let i = 0; i < sourceLines.length; i++)
     {
         let aLine = sourceLines[i].substr(0,240);  // avoid huge lines
         buf += aLine.replace(/\s/, " ", "g");
         if (buf.length > size || aLine.length > 240)
             break;
     }
     return buf.substr(0, size);
};


Firebug.SourceFile.NestedScriptAnalyzer = function(sourceFile)
{
    this.sourceFile = sourceFile;
};

Firebug.SourceFile.NestedScriptAnalyzer.prototype =
{
    // Adjust JSD line numbers based on origin of script
    getSourceLineFromFrame: function(context, frame)
    {
        if (FBTrace.DBG_SOURCEFILES) FBTrace.sysout("NestedScriptAnalyzer in "+this.sourceFile.compilation_unit_type+": frame.line  - this.sourceFile.getBaseLineOffset()",
             frame.line +" - "+this.sourceFile.getBaseLineOffset());

        return frame.line - (this.sourceFile.getBaseLineOffset());
    },
    // Interpret frame to give fn(args)
    getFunctionDescription: function(script, context, frame)
    {
        if (frame)
        {
            let name = frame.name;
            let args = FBL.getFunctionArgValues(frame);
        }
        else
        {
            let name = script.functionName;
            let args = [];
        }

        if (name ==  "anonymous")
        {
            name = FBL.guessFunctionName(this.sourceFile.href, this.getBaseLineNumberByScript(script), context);
        }

        return {name: name, args: args};
    },

    // link to source for this script.
    getSourceLinkForScript: function (script)
    {
        let line = this.getBaseLineNumberByScript(script);
        return new FBL.SourceLink(this.sourceFile.href, line, "js");
    },

    getBaseLineNumberByScript: function(script)
    {
        return script.baseLineNumber - (this.sourceFile.getBaseLineOffset() - 1);
    }
};

Firebug.SourceFile.addScriptsToSourceFile = function(sourceFile, outerScript, innerScripts)
{
    // Attach the innerScripts for use later
    if (!sourceFile.innerScripts)
         sourceFile.innerScripts = {};

     let total = 0;
     while (innerScripts.hasMoreElements())
     {
         let script = innerScripts.getNext();
         ///if (!script || ( (script instanceof Ci.jsdIScript) && !script.tag) )
         if (!script)
         {
             if (FBTrace.DBG_SOURCEFILES)
                 FBTrace.sysout("addScriptsToSourceFile innerScripts.getNext FAILS "+sourceFile, script);
             continue;
         }
         sourceFile.innerScripts[script.tag] = script;
         if (FBTrace.DBG_SOURCEFILES)
             total++;
     }
     if (FBTrace.DBG_SOURCEFILES)
         FBTrace.sysout("addScriptsToSourceFile "+ total +" scripts, sourcefile="+sourceFile.toString(), sourceFile);
};

/*
//------------
Firebug.EvalLevelSourceFile = function(url, script, eval_expr, source, mapType, innerScriptEnumerator) // ctor
{
    this.href = url.href;
    this.hrefKind = url.kind;
     this.outerScript = script;
     this.containingURL = script.fileName;
     this.evalExpression = eval_expr;
     this.sourceLength = source.length;
     this.source = source;
     this.pcmap_type = mapType;
     Firebug.SourceFile.addScriptsToSourceFile(this, script, innerScriptEnumerator);
};

Firebug.EvalLevelSourceFile.prototype =
    descend(new Firebug.SourceFile("eval-level"), // shared prototype
{
    getLine: function(context, lineNo)
    {
        return this.source[lineNo - 1];
    },

    getBaseLineOffset: function()
    {
        return this.outerScript.baseLineNumber - 1; // baseLineNumber always valid even after jsdIscript isValid false
    },

    getObjectDescription: function()
    {
         if (this.hrefKind == "source" || this.hrefKind == "data")
             return FBL.splitURLBase(this.href);

         if (!this.summary)
         {
             if (this.evalExpression)
                 this.summary = Firebug.SourceFile.summarizeSourceLineArray(this.evalExpression.substr(0, 240), 120);
             if (!this.summary)
                 this.summary = "";
             if (this.summary.length < 120)
                 this.summary = "eval("+this.summary + "...)=" + Firebug.SourceFile.summarizeSourceLineArray(this.source, 120 - this.summary.length);
         }
         let containingFileDescription = FBL.splitURLBase(this.containingURL);
         if (FBTrace.DBG_SOURCEFILES)
             FBTrace.sysout("EvalLevelSourceFile this.evalExpression.substr(0, 240):"+(this.evalExpression?this.evalExpression.substr(0, 240):"null")+" summary", this.summary);
         return {path: containingFileDescription.path, name: containingFileDescription.name+"/eval: "+this.summary };
    },

    getOuterScriptAnalyzer: function()
    {
        return new Firebug.EvalLevelSourceFile.OuterScriptAnalyzer(this);
    }

});

Firebug.EvalLevelSourceFile.OuterScriptAnalyzer = function(sourceFile)
{
    this.sourceFile = sourceFile;
};

Firebug.EvalLevelSourceFile.OuterScriptAnalyzer.prototype =
{
    // Adjust JSD line numbers based on origin of script
    getSourceLineFromFrame: function(context, frame)
    {
        return frame.line - this.sourceFile.getBaseLineOffset();
    },
    // Interpret frame to give fn(args)
    getFunctionDescription: function(script, context, frame)
    {
        return {name: "eval", args: [this.evalExpression] };
    },
    getSourceLinkForScript: function (script)
    {
        return new FBL.SourceLink(this.sourceFile.href, 1, "js");
    }
};

//------------
Firebug.EventSourceFile = function(url, script, title, source, innerScriptEnumerator)
{
     this.href = url;
     this.outerScript = script;
     this.containingURL = script.fileName;
     this.title = title;
     this.source = source; // points to the sourceCache lines
     this.sourceLength = source.length;
     this.pcmap_type = PCMAP_PRETTYPRINT;

     Firebug.SourceFile.addScriptsToSourceFile(this, script, innerScriptEnumerator);
};

Firebug.EventSourceFile.prototype =    descend(new Firebug.SourceFile("event"),  // prototypical inheritance
{
    getLine: function(context, lineNo)
    {
        return this.source[lineNo - 1];
    },

    getBaseLineOffset: function()
    {
        return 1;
    },

    getObjectDescription: function()
    {
        if (!this.summary)
             this.summary = Firebug.SourceFile.summarizeSourceLineArray(this.source, 120);

        let containingFileDescription = FBL.splitURLBase(this.containingURL);

        return {path: containingFileDescription.path, name: containingFileDescription.name+"/event: "+this.summary };
    },

    getOuterScriptAnalyzer: function()
    {
        return new Firebug.EventSourceFile.OuterScriptAnalyzer(this);
    }

});

Firebug.EventSourceFile.OuterScriptAnalyzer = function(sourceFile)
{
    this.sourceFile = sourceFile;
};

Firebug.EventSourceFile.OuterScriptAnalyzer.prototype =
{
    // Adjust JSD line numbers based on origin of script
    getSourceLineFromFrame: function(context, frame)
    {
        let script = frame.script;
        let line = script.pcToLine(frame.pc, PCMAP_PRETTYPRINT);
        return line - 1;
    },
    // Interpret frame to give fn(args)
    getFunctionDescription: function(script, context, frame)
    {
        if (frame)
        {
            let args = FBL.getFunctionArgValues(frame);
            let name = getFunctionName(script, context, frame, true);
        }
        else
        {
            let args = [];
            let name = getFunctionName(script, context);
        }
        return {name: name, args: args};
    },
    getSourceLinkForScript: function (script)
    {
        return new FBL.SourceLink(this.sourceFile.href, 1, "js");  // XXXjjb why do we need FBL.??
    }
};

//------------
Firebug.SourceFile.CommonBase =
{
    getSourceLength: function()
    {
        if (!this.sourceLength)
            this.sourceLength = this.context.sourceCache.load(this.href).length;
        return this.sourceLength;
    },

    getOuterScriptAnalyzer: function()
    {
        return Firebug.TopLevelSourceFile.OuterScriptAnalyzer;
    }

};
//-----------
Firebug.TopLevelSourceFile = function(url, outerScript, sourceLength, innerScriptEnumerator)
{
    this.href = url;
    this.outerScript = outerScript;  // Beware may not be valid after we return!!
    this.sourceLength = sourceLength;
    this.pcmap_type = PCMAP_SOURCETEXT;

    Firebug.SourceFile.addScriptsToSourceFile(this, outerScript, innerScriptEnumerator);
};

Firebug.TopLevelSourceFile.prototype = descend(new Firebug.SourceFile("top-level"), Firebug.SourceFile.CommonBase);


Firebug.TopLevelSourceFile.OuterScriptAnalyzer = {
    // Adjust JSD line numbers based on origin of script
    getSourceLineFromFrame: function(context, frame)
    {
        return frame.line;
    },
    // Interpret frame to give fn(args)
    getFunctionDescription: function(script, context, frame)
    {
        let file_name = FBL.getFileName(FBL.normalizeURL(script.fileName)); // this is more useful that just "top_level"
        file_name = file_name ? file_name: "__top_level__";
        return {name: file_name, args: []};
    },
    getSourceLinkForScript: function (script)
    {
        return FBL.SourceLink(FBL.normalizeURL(script.fileName), script.baseLineNumber, "js");
    }
};

//-------

Firebug.EnumeratedSourceFile = function(url) // we don't have the outer script and we delay source load.
{
    this.href = new String(url);  // may not be outerScript file name, eg this could be an enumerated eval
    this.innerScripts = {};
    this.pcmap_type = PCMAP_SOURCETEXT;
};

Firebug.EnumeratedSourceFile.prototype = descend(
        new Firebug.SourceFile("enumerated"),
        Firebug.SourceFile.CommonBase);

//---------
Firebug.NoScriptSourceFile = function(context, url) // Somehow we got the URL, but not the script
{
    this.href = url;  // we know this much
    this.innerScripts = {};
};

Firebug.NoScriptSourceFile.prototype = descend(
        new Firebug.SourceFile("URLOnly"),
        Firebug.SourceFile.CommonBase);

//---------// javascript in a .xul or .xml file, no outerScript
Firebug.XULSourceFile = function(url, outerScript, innerScriptEnumerator)
{
    this.href = url;
    this.pcmap_type = PCMAP_SOURCETEXT;
    this.outerScript = outerScript;  // Beware may not be valid after we return!!

    Firebug.SourceFile.addScriptsToSourceFile(this, outerScript, innerScriptEnumerator);
};

Firebug.XULSourceFile.prototype = descend(
        new Firebug.SourceFile("xul"),
        Firebug.SourceFile.CommonBase);

//---------
Firebug.ScriptTagAppendSourceFile = function(url, outerScript, sourceLength, innerScriptEnumerator) // element.appendChild(scriptTag)
{
    this.href = url;
    this.outerScript = outerScript;  // Beware may not be valid after we return!!
    this.sourceLength = sourceLength;
    this.pcmap_type = PCMAP_SOURCETEXT;

    Firebug.SourceFile.addScriptsToSourceFile(this, outerScript, innerScriptEnumerator);
};

Firebug.ScriptTagAppendSourceFile.prototype = descend(
        new Firebug.SourceFile("scriptTagAppend"),
        Firebug.SourceFile.CommonBase);

/**/
//-------------------

Firebug.ScriptTagSourceFile = function(context, url, scriptTagNumber) // we don't have the outer script and we delay source load
{
    this.context = context;
    this.href = url;  // we know this is not an eval
    this.scriptTagNumber = scriptTagNumber;
    this.innerScripts = {};
    this.pcmap_type = PCMAP_SOURCETEXT;
};

Firebug.ScriptTagSourceFile.prototype = descend(
        new Firebug.SourceFile("scriptTag"),
        Firebug.SourceFile.CommonBase);

//-------------------
Firebug.SourceFile.getSourceFileByScript = function(context, script)
{
    if (!context.sourceFileMap)
         return null;

    // Other algorithms are possible:
    //   We could store an index, context.sourceFileByTag
    //   Or we could build a tree keyed by url, with SpiderMonkey script.fileNames at the top and our urls below
    let lucky = context.sourceFileMap[script.fileName];  // we won't be lucky for file:/ urls, no normalizeURL applied
    if (FBTrace.DBG_SOURCEFILES && lucky)
        FBTrace.sysout("getSourceFileByScript trying to be lucky for "+
            script.tag + " in "+lucky, script);

    if (lucky && lucky.hasScript(script))
        return lucky;

    if (FBTrace.DBG_SOURCEFILES)
        FBTrace.sysout("getSourceFileByScript looking for "+script.tag+"@"+script.fileName+" in "+
            context.getName()+": ", context.sourceFileMap);

    for (let url in context.sourceFileMap)
    {
        let sourceFile = context.sourceFileMap[url];
        if (sourceFile.hasScript(script))
            return sourceFile;
    }
};

Firebug.SourceFile.getScriptAnalyzer = function(context, script)
{
    let sourceFile = Firebug.SourceFile.getSourceFileByScript(context, script);
    if (FBTrace.DBG_STACK)
         FBTrace.sysout("getScriptAnalyzer "+ (sourceFile?"finds sourceFile: ":"FAILS to find sourceFile"), sourceFile);
     if (sourceFile)
     {
         let analyzer = sourceFile.getScriptAnalyzer(script);
         if (FBTrace.DBG_STACK)
             FBTrace.sysout("getScriptAnalyzer finds analyzer: ", analyzer);

         return analyzer;
     }
     return undefined;
};

Firebug.SourceFile.getSourceFileAndLineByScript= function(context, script, frame)
{
    let sourceFile = Firebug.SourceFile.getSourceFileByScript(context, script);
    if (sourceFile)
    {
        let line;
        if (sourceFile.pcmap_type)
            line = script.pcToLine(1, sourceFile.pcmap_type);
        else
            line = 1;
        return { sourceFile: sourceFile, lineNo: line };
    }
};

Firebug.SourceFile.guessEnclosingFunctionName = function(url, line, context)
{
    let sourceFile = context.sourceFileMap[url];
    if (sourceFile)
    {
        let scripts = sourceFile.getScriptsAtLineNumber(line);
        if (scripts)
        {
            let script = scripts[0]; // TODO try others?
            let analyzer = sourceFile.getScriptAnalyzer(script);
            line = analyzer.getBaseLineNumberByScript(script);
        }
    }
    return FBL.guessFunctionName(url, line-1, context);
};

}});
