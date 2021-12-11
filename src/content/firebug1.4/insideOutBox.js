/* See license.txt for terms of usage */

FBL.ns(function() { with (FBL) {

/**
 * View interface used to populate an InsideOutBox object.
 *
 * All views must implement this interface (directly or via duck typing).
 */
FBL.InsideOutBoxView = {
    /**
     * Retrieves the parent object for a given child object.
     */
    getParentObject: function(child) {},

    /**
     * Retrieves a given child node.
     *
     * If both index and previousSibling are passed, the implementation
     * may assume that previousSibling will be the return for getChildObject
     * with index-1.
     */
    getChildObject: function(parent, index, previousSibling) {},

    /**
     * Renders the HTML representation of the object. Should return an HTML
     * object which will be displayed to the user.
     */
    createObjectBox: function(object, isRoot) {}
};

/**
 * Creates a tree based on objects provided by a separate "view" object.
 *
 * Construction uses an "inside-out" algorithm, meaning that the view's job is first
 * to tell us the ancestry of each object, and secondarily its descendants.
 */
FBL.InsideOutBox = function(view, box)
{
    this.view = view;
    this.box = box;

    this.rootObject = null;

    this.rootObjectBox = null;
    this.selectedObjectBox = null;
    this.highlightedObjectBox = null;

    this.onMouseDown = bind(this.onMouseDown, this);
    
    addEvent(box, "mousedown", this.onMouseDown);
    // TODO: xxxpedro event
    //box.addEventListener("mousedown", this.onMouseDown, false);
};

InsideOutBox.prototype =
{
    destroy: function()
    {
        removeEvent(box, "mousedown", this.onMouseDown);
        // TODO: xxxpedro event
        //this.box.removeEventListener("mousedown", this.onMouseDown, false);
    },

    highlight: function(object)
    {
        let objectBox = this.createObjectBox(object);
        this.highlightObjectBox(objectBox);
        return objectBox;
    },

    openObject: function(object)
    {
        let firstChild = this.view.getChildObject(object, 0);
        if (firstChild)
            object = firstChild;

        let objectBox = this.createObjectBox(object);
        this.openObjectBox(objectBox);
        return objectBox;
    },

    openToObject: function(object)
    {
        let objectBox = this.createObjectBox(object);
        this.openObjectBox(objectBox);
        return objectBox;
    },

    select: function(object, makeBoxVisible, forceOpen, noScrollIntoView)
    {
        if (FBTrace.DBG_HTML)
            FBTrace.sysout("insideOutBox.select object:", object);
        let objectBox = this.createObjectBox(object);
        this.selectObjectBox(objectBox, forceOpen);
        if (makeBoxVisible)
        {
            this.openObjectBox(objectBox);
            if (!noScrollIntoView)
                scrollIntoCenterView(objectBox);
        }
        return objectBox;
    },

    expandObject: function(object)
    {
        let objectBox = this.createObjectBox(object);
        if (objectBox)
            this.expandObjectBox(objectBox);
    },

    contractObject: function(object)
    {
        let objectBox = this.createObjectBox(object);
        if (objectBox)
            this.contractObjectBox(objectBox);
    },

    highlightObjectBox: function(objectBox)
    {
        if (this.highlightedObjectBox)
        {
            removeClass(this.highlightedObjectBox, "highlighted");

            let highlightedBox = this.getParentObjectBox(this.highlightedObjectBox);
            for (; highlightedBox; highlightedBox = this.getParentObjectBox(highlightedBox))
                removeClass(highlightedBox, "highlightOpen");
        }

        this.highlightedObjectBox = objectBox;

        if (objectBox)
        {
            setClass(objectBox, "highlighted");

            let highlightedBox = this.getParentObjectBox(objectBox);
            for (; highlightedBox; highlightedBox = this.getParentObjectBox(highlightedBox))
                setClass(highlightedBox, "highlightOpen");

           scrollIntoCenterView(objectBox);
        }
    },

    selectObjectBox: function(objectBox, forceOpen)
    {
        let isSelected = this.selectedObjectBox && objectBox == this.selectedObjectBox;
        if (!isSelected)
        {
            removeClass(this.selectedObjectBox, "selected");
            dispatch([Firebug.A11yModel], 'onObjectBoxUnselected', [this.selectedObjectBox]);
            this.selectedObjectBox = objectBox;

            if (objectBox)
            {
                setClass(objectBox, "selected");

                // Force it open the first time it is selected
                if (forceOpen)
                    this.toggleObjectBox(objectBox, true);
            }
        }
        dispatch([Firebug.A11yModel], 'onObjectBoxSelected', [objectBox]);
    },

    openObjectBox: function(objectBox)
    {
        if (objectBox)
        {
            // Set all of the node's ancestors to be permanently open
            let parentBox = this.getParentObjectBox(objectBox);
            let labelBox;
            for (; parentBox; parentBox = this.getParentObjectBox(parentBox))
            {
                setClass(parentBox, "open");
                labelBox = getElementByClass(parentBox, 'nodeLabelBox');
                if (labelBox)
                    labelBox.setAttribute('aria-expanded', 'true')
            }
        }
    },

    expandObjectBox: function(objectBox)
    {
        let nodeChildBox = this.getChildObjectBox(objectBox);
        if (!nodeChildBox)
            return;

        if (!objectBox.populated)
        {
            let firstChild = this.view.getChildObject(objectBox.repObject, 0);
            this.populateChildBox(firstChild, nodeChildBox);
        }
        let labelBox = getElementByClass(objectBox, 'nodeLabelBox');
        if (labelBox)
            labelBox.setAttribute('aria-expanded', 'true');
        setClass(objectBox, "open");
    },

    contractObjectBox: function(objectBox)
    {
        removeClass(objectBox, "open");
        let nodeLabel = getElementByClass(objectBox, "nodeLabel");
        let labelBox = getElementByClass(nodeLabel, 'nodeLabelBox');
        if (labelBox)
            labelBox.setAttribute('aria-expanded', 'false');
    },

    toggleObjectBox: function(objectBox, forceOpen)
    {
        let isOpen = hasClass(objectBox, "open");
        let nodeLabel = getElementByClass(objectBox, "nodeLabel");
        let labelBox = getElementByClass(nodeLabel, 'nodeLabelBox');
        if (labelBox)
            labelBox.setAttribute('aria-expanded', isOpen);
        if (!forceOpen && isOpen)
            this.contractObjectBox(objectBox);

        else if (!isOpen)
            this.expandObjectBox(objectBox);
    },

    getNextObjectBox: function(objectBox)
    {
        return findNext(objectBox, isVisibleTarget, false, this.box);
    },

    getPreviousObjectBox: function(objectBox)
    {
        return findPrevious(objectBox, isVisibleTarget, true, this.box);
    },

    /**
     * Creates all of the boxes for an object, its ancestors, and siblings.
     */
    createObjectBox: function(object)
    {
        if (!object)
            return null;

        this.rootObject = this.getRootNode(object);

        // Get or create all of the boxes for the target and its ancestors
        let objectBox = this.createObjectBoxes(object, this.rootObject);

        if (FBTrace.DBG_HTML)
            FBTrace.sysout("\n----\ninsideOutBox.createObjectBox for object="+formatNode(object)+" got objectBox="+formatNode(objectBox), objectBox);
        if (!objectBox)
            return null;
        else if (object == this.rootObject)
            return objectBox;
        else
            return this.populateChildBox(object, objectBox.parentNode);
    },

    /**
     * Creates all of the boxes for an object, its ancestors, and siblings up to a root.
     */
    createObjectBoxes: function(object, rootObject)
    {
        if (FBTrace.DBG_HTML)
            FBTrace.sysout("\n----\ninsideOutBox.createObjectBoxes("+formatNode(object)+", "+formatNode(rootObject)+")\n");
        if (!object)
            return null;

        if (object == rootObject)
        {
            if (!this.rootObjectBox || this.rootObjectBox.repObject != rootObject)
            {
                if (this.rootObjectBox)
                {
                    try {
                        this.box.removeChild(this.rootObjectBox);
                    } catch (exc) {
                        if (FBTrace.DBG_HTML)
                            FBTrace.sysout(" this.box.removeChild(this.rootObjectBox) FAILS "+this.box+" must not contain "+this.rootObjectBox+"\n");
                    }
                }

                this.highlightedObjectBox = null;
                this.selectedObjectBox = null;
                this.rootObjectBox = this.view.createObjectBox(object, true);
                this.box.appendChild(this.rootObjectBox);
            }
            if (FBTrace.DBG_HTML)
            {
                FBTrace.sysout("insideOutBox.createObjectBoxes("+formatNode(object)+","+formatNode(rootObject)+") rootObjectBox: "
                                            +this.rootObjectBox, object);
            }
            return this.rootObjectBox;
        }
        else
        {
            let parentNode = this.view.getParentObject(object);

            if (FBTrace.DBG_HTML)
            {
                FBTrace.sysout("insideOutBox.createObjectBoxes getObjectPath(object) ", getObjectPath(object, this.view))
                FBTrace.sysout("insideOutBox.createObjectBoxes view.getParentObject("+formatNode(object)+")=parentNode: "+formatNode(parentNode), parentNode);
            }

            let parentObjectBox = this.createObjectBoxes(parentNode, rootObject);
            if (FBTrace.DBG_HTML)
                FBTrace.sysout("insideOutBox.createObjectBoxes createObjectBoxes("+formatNode(parentNode)+","+formatNode(rootObject)+"):parentObjectBox: "+formatNode(parentObjectBox), parentObjectBox);
            if (!parentObjectBox)
                return null;

            let parentChildBox = this.getChildObjectBox(parentObjectBox);
            if (FBTrace.DBG_HTML)
                FBTrace.sysout("insideOutBox.createObjectBoxes getChildObjectBox("+formatNode(parentObjectBox)+")= parentChildBox: "+formatNode(parentChildBox)+"\n");
            if (!parentChildBox)
                return null;

            let childObjectBox = this.findChildObjectBox(parentChildBox, object);
            if (FBTrace.DBG_HTML)
                FBTrace.sysout("insideOutBox.createObjectBoxes findChildObjectBox("+formatNode(parentChildBox)+","+formatNode(object)+"): childObjectBox: "+formatNode(childObjectBox), childObjectBox);
            return childObjectBox
                ? childObjectBox
                : this.populateChildBox(object, parentChildBox);
        }
    },

    findObjectBox: function(object)
    {
        if (!object)
            return null;

        if (object == this.rootObject)
            return this.rootObjectBox;
        else
        {
            let parentNode = this.view.getParentObject(object);
            let parentObjectBox = this.findObjectBox(parentNode);
            if (!parentObjectBox)
                return null;

            let parentChildBox = this.getChildObjectBox(parentObjectBox);
            if (!parentChildBox)
                return null;

            return this.findChildObjectBox(parentChildBox, object);
        }
    },

    appendChildBox: function(parentNodeBox, repObject)
    {
        let childBox = this.getChildObjectBox(parentNodeBox);
        let objectBox = this.findChildObjectBox(childBox, repObject);
        if (objectBox)
            return objectBox;

        objectBox = this.view.createObjectBox(repObject);
        if (objectBox)
        {
            let childBox = this.getChildObjectBox(parentNodeBox);
            childBox.appendChild(objectBox);
        }
        return objectBox;
    },

    insertChildBoxBefore: function(parentNodeBox, repObject, nextSibling)
    {
        let childBox = this.getChildObjectBox(parentNodeBox);
        let objectBox = this.findChildObjectBox(childBox, repObject);
        if (objectBox)
            return objectBox;

        objectBox = this.view.createObjectBox(repObject);
        if (objectBox)
        {
            let siblingBox = this.findChildObjectBox(childBox, nextSibling);
            childBox.insertBefore(objectBox, siblingBox);
        }
        return objectBox;
    },

    removeChildBox: function(parentNodeBox, repObject)
    {
        let childBox = this.getChildObjectBox(parentNodeBox);
        let objectBox = this.findChildObjectBox(childBox, repObject);
        if (objectBox)
            childBox.removeChild(objectBox);
    },

    populateChildBox: function(repObject, nodeChildBox)  // We want all children of the parent of repObject.
    {
        if (!repObject)
            return null;

        let parentObjectBox = getAncestorByClass(nodeChildBox, "nodeBox");
        if (FBTrace.DBG_HTML)
            FBTrace.sysout("+++insideOutBox.populateChildBox("+(repObject.localName?repObject.localName:repObject)+") parentObjectBox.populated "+parentObjectBox.populated+"\n");
        if (parentObjectBox.populated)
            return this.findChildObjectBox(nodeChildBox, repObject);

        let lastSiblingBox = this.getChildObjectBox(nodeChildBox);
        let siblingBox = nodeChildBox.firstChild;
        let targetBox = null;

        let view = this.view;

        let targetSibling = null;
        let parentNode = view.getParentObject(repObject);
        for (let i = 0; 1; ++i)
        {
            targetSibling = view.getChildObject(parentNode, i, targetSibling);
            if (!targetSibling)
                break;

            // Check if we need to start appending, or continue to insert before
            if (lastSiblingBox && lastSiblingBox.repObject == targetSibling)
                lastSiblingBox = null;

            if (!siblingBox || siblingBox.repObject != targetSibling)
            {
                let newBox = view.createObjectBox(targetSibling);
                if (newBox)
                {
                    if (lastSiblingBox)
                        nodeChildBox.insertBefore(newBox, lastSiblingBox);
                    else
                        nodeChildBox.appendChild(newBox);
                }

                siblingBox = newBox;
            }

            if (targetSibling == repObject)
                targetBox = siblingBox;

            if (siblingBox && siblingBox.repObject == targetSibling)
                siblingBox = siblingBox.nextSibling;
        }

        if (targetBox)
            parentObjectBox.populated = true;
        if (FBTrace.DBG_HTML)
            FBTrace.sysout("---insideOutBox.populateChildBox("+(repObject.localName?repObject.localName:repObject)+") targetBox "+targetBox+"\n");

        return targetBox;
    },

    getParentObjectBox: function(objectBox)
    {
        let parent = objectBox.parentNode ? objectBox.parentNode.parentNode : null;
        return parent && parent.repObject ? parent : null;
    },

    getChildObjectBox: function(objectBox)
    {
        return getElementByClass(objectBox, "nodeChildBox");
    },

    findChildObjectBox: function(parentNodeBox, repObject)
    {
        for (let childBox = parentNodeBox.firstChild; childBox; childBox = childBox.nextSibling)
        {
            if (FBTrace.DBG_HTML)
                FBTrace.sysout(
                    "insideOutBox.findChildObjectBox "
                    +(childBox.repObject == repObject?"match ":"no match ")
                    +" childBox.repObject: " + (childBox.repObject && (childBox.repObject.localName || childBox.repObject))
                    +" repObject: " +(repObject && (repObject.localName || repObject))+"\n", childBox);
            if (childBox.repObject == repObject)
                return childBox;
        }
    },

    /**
     * Determines if the given node is an ancestor of the current root.
     */
    isInExistingRoot: function(node)
    {
        if (FBTrace.DBG_HTML)
          FBTrace.sysout("insideOutBox.isInExistingRoot for ", node);
        let parentNode = node;
        while (parentNode && parentNode != this.rootObject)
        {
            if (FBTrace.DBG_HTML)
                FBTrace.sysout(parentNode.localName+" < ", parentNode);
            let parentNode = this.view.getParentObject(parentNode);
            if (FBTrace.DBG_HTML)
                FBTrace.sysout((parentNode?" (parent="+parentNode.localName+")":" (null parentNode)"+"\n"), parentNode);
        }
        return parentNode == this.rootObject;
    },

    getRootNode: function(node)
    {
        if (FBTrace.DBG_HTML)
            FBTrace.sysout("insideOutBox.getRootNode for ", node);
        while (1)
        {
            if (FBTrace.DBG_HTML)
                FBTrace.sysout(node.localName+" < ", node);
            let parentNode = this.view.getParentObject(node);
            if (FBTrace.DBG_HTML)
                FBTrace.sysout((parentNode?" (parent="+parentNode.localName+")":" (null parentNode)"+"\n"), parentNode);

            if (!parentNode)
                return node;
            else
                node = parentNode;
        }
        return null;
    },

    // ********************************************************************************************

    onMouseDown: function(event)
    {
        let hitTwisty = false;
        for (let child = event.target; child; child = child.parentNode)
        {
            if (hasClass(child, "twisty"))
                hitTwisty = true;
            else if (child.repObject)
            {
                if (hitTwisty)
                    this.toggleObjectBox(child);
                break;
            }
        }
    }
};

// ************************************************************************************************
// Local Helpers

function isVisibleTarget(node)
{
    if (node.repObject && node.repObject.nodeType == Node.ELEMENT_NODE)
    {
        for (let parent = node.parentNode; parent; parent = parent.parentNode)
        {
            if (hasClass(parent, "nodeChildBox")
                && !hasClass(parent.parentNode, "open")
                && !hasClass(parent.parentNode, "highlightOpen"))
                return false;
        }
        return true;
    }
}

function formatNode(object)
{
    if (object)
        return (object.localName ? object.localName : object);
    else
        return "(null object)";
}

function getObjectPath(element, aView)
{
    let path = [];
    for (; element; element = aView.getParentObject(element))
        path.push(element);

    return path;
}

}});
