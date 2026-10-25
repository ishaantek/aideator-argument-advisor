import React, { useState } from "react";

function TreeNode({ node, onSelectNode, selectedNodeId }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const isSelected = node.id === selectedNodeId;

  const handleToggle = (e) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleSelect = (e) => {
    e.stopPropagation();
    onSelectNode(node);
  };

  return (
    <div className="tree-node">
      <div 
        className={`tree-node-content ${isSelected ? "selected" : ""}`} 
        onClick={handleSelect}
      >
        {node.children && node.children.length > 0 && (
          <button className="tree-toggle" onClick={handleToggle}>
            {isExpanded ? "▼" : "▶"}
          </button>
        )}
        {(!node.children || node.children.length === 0) && (
          <span className="tree-toggle-spacer"></span>
        )}
        <span className={`node-type badge-${(node.subtype || node.type || "node").toLowerCase()}`}>
          {node.subtype || node.type}
        </span>
        <span className="node-name">{node.name}</span>
      </div>
      {isExpanded && node.children && node.children.length > 0 && (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeNode 
              key={child.id} 
              node={child} 
              onSelectNode={onSelectNode} 
              selectedNodeId={selectedNodeId} 
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function MapViewer({ mapData, onSelectNode, selectedNodeId }) {
  if (!mapData) return <div className="map-viewer empty">No map data loaded.</div>;

  return (
    <div className="map-viewer">
      <div className="map-header">
        <h2>AIdeator Map</h2>
        <p>Select a node to add a PRO or CON argument to it.</p>
      </div>
      <div className="map-tree-container">
        <TreeNode 
          node={mapData} 
          onSelectNode={onSelectNode} 
          selectedNodeId={selectedNodeId} 
        />
      </div>
    </div>
  );
}
