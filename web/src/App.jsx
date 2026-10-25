import { useEffect, useRef, useState } from "react";
import MapViewer from "./MapViewer";
import exampleMapData from "./example-map.json";

const SCHEME_NAMES = {
  AUTHORITY: "expert authority",
  CAUSE_EFFECT: "cause and effect",
  DATA: "evidence and data",
  EXAMPLE: "example or analogy",
  OPINION: "values or opinion",
};

const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function cleanText(value) {
  return String(value || "")
    .replace(/&#13;|\r/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function summarizeNode(node) {
  return {
    id: node.id,
    type: node.type || "",
    subtype: node.subtype || "",
    name: node.name || "",
    description: cleanText(node.description || ""),
  };
}

function findNodePath(node, id, trail = []) {
  const next = [...trail, node];
  if (node.id === id) return next;
  for (const child of node.children || []) {
    const found = findNodePath(child, id, next);
    if (found) return found;
  }
  return null;
}

function buildMapContext(mapData, selectedNode, argumentType) {
  if (!selectedNode) return null;
  const pathNodes = findNodePath(mapData, selectedNode.id) || [selectedNode];
  const existing = (selectedNode.children || [])
    .filter((child) => child.type === "ARGUMENT" || ["PRO", "CON"].includes(child.subtype))
    .map((child) => ({
      stance: child.subtype || "ARGUMENT",
      name: child.name || "",
      description: cleanText(child.description || ""),
    }));

  return {
    stance: argumentType,
    target: summarizeNode(selectedNode),
    path: pathNodes.map(summarizeNode),
    existing_arguments: existing,
  };
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

function toHistory(messages) {
  return messages
    .filter((message) => message.role === "student" || message.role === "advisor")
    .map((message) => ({
      role: message.role,
      content:
        message.type === "coach"
          ? `I identified ${message.data.scheme_plain_name}. Main gap: ${message.data.the_gap}`
          : message.content,
    }));
}

function Mark() {
  return (
    <div className="mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

function Thinking({ label }) {
  return (
    <div className="thinking" role="status">
      <span className="thinking-dot" />
      <span className="thinking-dot" />
      <span className="thinking-dot" />
      <span>{label}</span>
    </div>
  );
}

function ReadIndicator({ read }) {
  if (!read) return null;
  const first = SCHEME_NAMES[read.top_two[0]];
  const second = SCHEME_NAMES[read.top_two[1]];
  return (
    <div className="model-read">
      <span className="pulse" />
      {read.confident ? `Reading this as ${first}` : `Leaning toward ${first} vs ${second}`}
    </div>
  );
}

function CoachingCard({ data, onRevise }) {
  return (
    <article className="coach-card">
      <div className="coach-heading">
        <div>
          <span className="eyebrow">Your reasoning pattern</span>
          <h2>{data.scheme_plain_name}</h2>
        </div>
        <span className="scheme-seal" aria-hidden="true">
          ✓
        </span>
      </div>

      <section className="coach-section success">
        <h3>What’s working</h3>
        <p>{data.what_youre_doing_well}</p>
      </section>

      <section className="coach-section gap">
        <h3>The gap to close</h3>
        <p>{data.the_gap}</p>
      </section>

      <section className="coach-section">
        <h3>Questions your reader may ask</h3>
        <ul className="question-list">
          {data.critical_questions_to_address.map((question, index) => (
            <li key={`${question}-${index}`}>
              <span className="check-box" aria-hidden="true" />
              <span>{question}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="next-step">
        <span className="eyebrow">Your next move</span>
        <p>{data.concrete_next_step}</p>
      </section>

      {data.stronger_version && (
        <section className="rewrite">
          <span className="eyebrow">A stronger version might sound like</span>
          <p>“{data.stronger_version.replace(/^["“]|["”]$/g, "")}”</p>
        </section>
      )}

      <button className="revise-button" type="button" onClick={onRevise}>
        Revise this argument
        <span aria-hidden="true">→</span>
      </button>
    </article>
  );
}

function MapContextBar({ mapContext }) {
  if (!mapContext) return null;
  const lastIndex = mapContext.path.length - 1;
  return (
    <div className="map-context-bar">
      <div className="map-context-meta">
        <span className={`stance-chip ${mapContext.stance.toLowerCase()}`}>
          {mapContext.stance}
        </span>
        <span className="eyebrow">
          {mapContext.target.subtype}
        </span>
      </div>
      <ol className="map-path">
        {mapContext.path.map((node, index) => (
          <li key={node.id} className={index === lastIndex ? "current" : ""}>
            <span className="path-kind">{node.subtype}</span>
            <span className="path-name">{node.name}</span>
            {index < lastIndex && <span className="path-arrow" aria-hidden="true">→</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

function EmptyState({ starter, onStarter, selectedNode, mapContext }) {
  return (
    <div className="empty-state">
      <div className="empty-ornament" aria-hidden="true">
        <span>?</span>
      </div>
      {selectedNode ? (
        <>
          <h1>Draft an argument for:<br />{selectedNode.name}</h1>
          <p>
            I’ll read this as a {mapContext?.stance || "PRO"} on this {selectedNode.subtype},
            using the whole chain above it as the point you’re arguing about.
          </p>
        </>
      ) : (
        <>
          <h1>Find the reasoning<br />inside your argument.</h1>
          <p>
            Select a node from the map on the left to start drafting an argument for it.
          </p>
        </>
      )}
      {starter && !selectedNode && (
        <button className="starter-card" type="button" onClick={() => onStarter(starter)}>
          <span className="eyebrow">Try an example</span>
          <span>“{starter}”</span>
          <span className="starter-arrow" aria-hidden="true">→</span>
        </button>
      )}
    </div>
  );
}

export default function App() {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [currentArgument, setCurrentArgument] = useState("");
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [read, setRead] = useState(null);
  const [busy, setBusy] = useState("");
  const [starter, setStarter] = useState("");
  const [diagnosticCount, setDiagnosticCount] = useState(0);
  const [contextCount, setContextCount] = useState(0);
  
  const [mapData, setMapData] = useState(exampleMapData);
  const [selectedNode, setSelectedNode] = useState(null);
  const [argumentType, setArgumentType] = useState("PRO");
  const mapContext = buildMapContext(mapData, selectedNode, argumentType);

  const endRef = useRef(null);
  const textareaRef = useRef(null);

  const advisorBody = (extra = {}) =>
    JSON.stringify({
      history: extra.history,
      mapContext,
      ...extra,
    });

  useEffect(() => {
    api("/api/starter")
      .then((result) => setStarter(result.argument))
      .catch(() => {});
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  const handleSelectNode = (node) => {
    setSelectedNode(node);
    setMessages([]);
    setCurrentArgument("");
    setDraft("");
    setActiveQuestion(null);
    setRead(null);
    setDiagnosticCount(0);
    setContextCount(0);
  };

  const saveToMap = () => {
    if (!selectedNode || !currentArgument) return;
    
    const newArgument = {
      type: "ARGUMENT",
      subtype: argumentType,
      name: currentArgument.substring(0, 50) + (currentArgument.length > 50 ? "..." : ""),
      description: currentArgument,
      id: "E-" + uid().toUpperCase(),
      author: "Student",
      children: []
    };

    // Deep clone and update mapData
    const updateTree = (node) => {
      if (node.id === selectedNode.id) {
        return {
          ...node,
          children: [...(node.children || []), newArgument]
        };
      }
      if (node.children) {
        return {
          ...node,
          children: node.children.map(updateTree)
        };
      }
      return node;
    };

    const nextMap = updateTree(mapData);
    setMapData(nextMap);
    const refreshed = findNodePath(nextMap, selectedNode.id);
    if (refreshed) setSelectedNode(refreshed[refreshed.length - 1]);

    setMessages([]);
    setCurrentArgument("");
    setDraft("");
    setActiveQuestion(null);
    setRead(null);
    setDiagnosticCount(0);
    setContextCount(0);
  };

  const addAdvisorMessage = (message, baseMessages = messages) => {
    const next = [...baseMessages, { id: uid(), role: "advisor", ...message }];
    setMessages(next);
    return next;
  };

  async function coach(argumentText, classification, historyMessages) {
    setBusy("Building your advice");
    const coaching = await api("/api/advisor/coach", {
      method: "POST",
      body: advisorBody({
        argument: argumentText,
        history: toHistory(historyMessages),
        scheme: classification.top_two[0],
        intent: classification.best_guess_of_intent,
      }),
    });
    addAdvisorMessage({ type: "coach", data: coaching }, historyMessages);
    setBusy("");
  }

  async function classify(
    argumentText,
    historyMessages,
    nextDiagnosticCount = diagnosticCount,
    nextContextCount = contextCount,
  ) {
    try {
      setBusy("Reading your reasoning");
      const classification = await api("/api/advisor/classify", {
        method: "POST",
        body: advisorBody({
          argument: argumentText,
          history: toHistory(historyMessages),
        }),
      });
      setRead(classification);

      if (classification.needs_context && nextContextCount < 2) {
        const question = {
          id: uid(),
          role: "advisor",
          type: "question",
          content: classification.context_question,
          hints: [],
        };
        setMessages([...historyMessages, question]);
        setActiveQuestion({ kind: "context", id: question.id });
        setBusy("");
        return;
      }

      if (!classification.confident && nextDiagnosticCount < 3) {
        setBusy("Narrowing down the pattern");
        const diagnostic = await api("/api/advisor/diagnostic", {
          method: "POST",
          body: advisorBody({
            argument: argumentText,
            history: toHistory(historyMessages),
            topTwo: classification.top_two,
            intent: classification.best_guess_of_intent,
          }),
        });
        const question = {
          id: uid(),
          role: "advisor",
          type: "question",
          content: diagnostic.question,
          why: diagnostic.why_asking,
          hints: diagnostic.answer_hints,
        };
        setMessages([...historyMessages, question]);
        setActiveQuestion({ kind: "diagnostic", id: question.id });
        setBusy("");
        return;
      }

      setActiveQuestion(null);
      await coach(argumentText, classification, historyMessages);
    } catch (error) {
      addAdvisorMessage(
        {
          type: "error",
          content: error.message || "I lost my train of thought. Please try that again.",
        },
        historyMessages,
      );
      setBusy("");
    }
  }

  function submitArgument(text) {
    const cleaned = text.trim();
    if (!cleaned || busy) return;
    const userMessage = { id: uid(), role: "student", type: "text", content: cleaned };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setCurrentArgument(cleaned);
    setDraft("");
    setActiveQuestion(null);
    setRead(null);
    setDiagnosticCount(0);
    setContextCount(0);
    classify(cleaned, nextMessages, 0, 0);
  }

  function submitAnswer(text) {
    const cleaned = text.trim();
    if (!cleaned || busy || !activeQuestion) return;
    const userMessage = { id: uid(), role: "student", type: "text", content: cleaned };
    const nextMessages = [...messages, userMessage];
    const nextDiagnosticCount =
      diagnosticCount + (activeQuestion.kind === "diagnostic" ? 1 : 0);
    const nextContextCount = contextCount + (activeQuestion.kind === "context" ? 1 : 0);
    setMessages(nextMessages);
    setDraft("");
    setActiveQuestion(null);
    setDiagnosticCount(nextDiagnosticCount);
    setContextCount(nextContextCount);
    classify(currentArgument, nextMessages, nextDiagnosticCount, nextContextCount);
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (activeQuestion) submitAnswer(draft);
    else submitArgument(draft);
  }

  function chooseHint(hint) {
    setDraft(hint);
    submitAnswer(hint);
  }

  function revise() {
    setDraft(currentArgument);
    setActiveQuestion(null);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(currentArgument.length, currentArgument.length);
    });
  }

  const placeholder = activeQuestion
    ? "Type your answer…"
    : !selectedNode
      ? "Select a node on the map first…"
      : messages.length
        ? `Revise this ${argumentType} or keep developing it…`
        : `Write a ${argumentType} for this ${selectedNode.subtype}…`;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Argument Advisor home">
          <Mark />
          <span>Argument Advisor</span>
        </a>
        <ReadIndicator read={read} />
        <span className="private-note">Your draft stays in this session</span>
      </header>

      <div className="app-body">
        <div className="left-pane">
          <MapViewer 
            mapData={mapData} 
            onSelectNode={handleSelectNode} 
            selectedNodeId={selectedNode?.id} 
          />
        </div>
        
        <div className="right-pane">
          <main className={`conversation ${messages.length ? "has-messages" : ""}`}>
            {selectedNode && <MapContextBar mapContext={mapContext} />}
            {!messages.length && (
              <EmptyState
                starter={starter}
                onStarter={submitArgument}
                selectedNode={selectedNode}
                mapContext={mapContext}
              />
            )}

            {selectedNode && !messages.length && (
              <div className="argument-form">
                <h3>Select Argument Type</h3>
                <div className="argument-type-selector">
                  <label>
                    <input 
                      type="radio" 
                      name="argType" 
                      value="PRO" 
                      checked={argumentType === "PRO"} 
                      onChange={() => setArgumentType("PRO")} 
                    />
                    PRO (Supports the node)
                  </label>
                  <label>
                    <input 
                      type="radio" 
                      name="argType" 
                      value="CON" 
                      checked={argumentType === "CON"} 
                      onChange={() => setArgumentType("CON")} 
                    />
                    CON (Opposes the node)
                  </label>
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div className={`message-row ${message.role}`} key={message.id}>
                {message.role === "advisor" && (
                  <div className="advisor-avatar" aria-hidden="true">
                    A
                  </div>
                )}
                {message.type === "coach" ? (
                  <>
                    <CoachingCard data={message.data} onRevise={revise} />
                    <button className="save-to-map-btn" onClick={saveToMap}>
                      Save Argument to Map
                    </button>
                  </>
                ) : (
                  <div className={`bubble ${message.type}`}>
                    {message.role === "advisor" && message.type === "question" && (
                      <span className="eyebrow">One thing I’m wondering</span>
                    )}
                    <p>{message.content}</p>
                    {message.why && <span className="why-asking">{message.why}</span>}
                    {message.hints?.length > 0 && activeQuestion?.id === message.id && (
                      <div className="answer-hints">
                        {message.hints.map((hint) => (
                          <button type="button" key={hint} onClick={() => chooseHint(hint)}>
                            {hint}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {busy && (
              <div className="message-row advisor">
                <div className="advisor-avatar" aria-hidden="true">A</div>
                <Thinking label={busy} />
              </div>
            )}

            {read && (
              <details className="why-panel">
                <summary>Why this read?</summary>
                <p>{read.best_guess_of_intent}</p>
                <span>
                  Considering {SCHEME_NAMES[read.top_two[0]]} and{" "}
                  {SCHEME_NAMES[read.top_two[1]]}.
                </span>
              </details>
            )}
            <div ref={endRef} />
          </main>

          <footer className="composer-wrap">
            <form className="composer" onSubmit={handleSubmit}>
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleSubmit(event);
                  }
                }}
                placeholder={placeholder}
                rows={1}
                disabled={Boolean(busy) || !selectedNode}
                aria-label={activeQuestion ? "Your answer" : "Your argument"}
              />
              <button
                className="send-button"
                type="submit"
                disabled={!draft.trim() || Boolean(busy) || !selectedNode}
                aria-label="Send"
              >
                <span aria-hidden="true">↑</span>
              </button>
            </form>
            <p className="composer-note">
              {activeQuestion ? "Your answer helps me choose the right kind of advice." : "Rough drafts welcome. Shift + Enter for a new line."}
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
