'use client';

/******************************************************************************
                         AKN Element Renderer
  Recursively renders a DOM Element from parsed AKN 3.0 XML into React JSX
  with CSS classes from .statute-document for legal document typography.
******************************************************************************/

/** AKN structural elements that get ORDER/Chapter-level headings */
const STRUCTURAL_TAGS = new Set([
  'subpart', 'chapter', 'part', 'act', 'division', 'subdivision', 'title', 'book',
]);

interface AknElementRendererProps {
  element: Element;
}

/**
 * Recursively renders a single AKN XML DOM element into styled JSX.
 */
function AknElementRenderer({ element }: AknElementRendererProps) {
  const tag = element.localName;

  // --- Structural containers (subpart, chapter, part, etc.) ---
  if (STRUCTURAL_TAGS.has(tag)) {
    return (
      <div>
        {renderChildElements(element)}
      </div>
    );
  }

  // --- Schedule ---
  if (tag === 'schedule') {
    return (
      <div>
        {renderChildElements(element)}
      </div>
    );
  }

  // --- Attachment-related containers (schedules, appendices) ---
  if (tag === 'attachments' || tag === 'attachment' || tag === 'doc' || tag === 'mainbody') {
    return <>{renderChildElements(element)}</>;
  }

  // --- Heading (inside structural elements) ---
  if (tag === 'heading') {
    const parentTag = element.parentElement?.localName;
    const isScheduleHeading = parentTag === 'schedule' || parentTag === 'attachment';
    const className = isScheduleHeading ? 'schedule-heading' : 'order-heading';
    return <h2 className={className}>{element.textContent}</h2>;
  }

  // --- Intro (text before children) ---
  if (tag === 'intro') {
    return (
      <div className="node-intro">
        {renderChildElements(element)}
      </div>
    );
  }

  // --- Content (main body) ---
  if (tag === 'content') {
    return (
      <div className="node-content">
        {renderChildElements(element)}
      </div>
    );
  }

  // --- WrapUp (text after children) ---
  if (tag === 'wrapup') {
    return (
      <div className="node-wrapup">
        {renderChildElements(element)}
      </div>
    );
  }

  // --- Subsection (hanging indent with number) ---
  if (tag === 'subsection') {
    const num = element.querySelector(':scope > num');
    const contentEl = element.querySelector(':scope > content');
    return (
      <div>
        <div className="subsection">
          {num && <span className="num">{num.textContent}</span>}
          {contentEl && renderInlineContent(contentEl)}
        </div>
      </div>
    );
  }

  // --- Paragraph / item (deeper indent) ---
  if (tag === 'paragraph' || tag === 'item') {
    const num = element.querySelector(':scope > num');
    const contentEl = element.querySelector(':scope > content');
    return (
      <div>
        <div className="paragraph-item">
          {num && <span className="num">{num.textContent}</span>}
          {contentEl && renderInlineContent(contentEl)}
        </div>
      </div>
    );
  }

  // --- Crossheading ---
  if (tag === 'crossheading') {
    return <div className="crossheading">{element.textContent}</div>;
  }

  // --- hcontainer ---
  if (tag === 'hcontainer') {
    return (
      <div className="hcontainer-block">
        {renderChildElements(element)}
      </div>
    );
  }

  // --- <p> — the key win: each paragraph is its own element ---
  if (tag === 'p') {
    return (
      <p className="rule-block" dangerouslySetInnerHTML={{ __html: element.innerHTML }} />
    );
  }

  // --- <num> — skip when standalone (handled by parent) ---
  if (tag === 'num') {
    return null;
  }

  // --- <ul> / <ol> — HTML lists (from fixed backend) ---
  if (tag === 'ul' || tag === 'ol') {
    return (
      <div dangerouslySetInnerHTML={{ __html: element.outerHTML }} />
    );
  }

  // --- <blockList> — AKN list structure ---
  if (tag === 'blocklist') {
    return (
      <div className="node-content">
        {renderChildElements(element)}
      </div>
    );
  }

  // --- <listIntroduction> ---
  if (tag === 'listintroduction') {
    return <p className="rule-block">{element.textContent}</p>;
  }

  // --- <body> — top-level container, just recurse ---
  if (tag === 'body' || tag === 'akomantoso' || tag === 'act') {
    return <>{renderChildElements(element)}</>;
  }

  // --- Default fallback: recurse children ---
  return <>{renderChildElements(element)}</>;
}

/******************************************************************************
                               Helpers
******************************************************************************/

/**
 * Renders all child Element nodes of a parent (skips text-only nodes).
 */
function renderChildElements(parent: Element) {
  const children: React.ReactNode[] = [];
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    children.push(<AknElementRenderer key={i} element={child} />);
  }
  return <>{children}</>;
}

/**
 * Renders content element's <p> children inline (for subsection/paragraph
 * where the first <p> flows after the number on the same line).
 */
function renderInlineContent(contentEl: Element) {
  const pElements = contentEl.querySelectorAll(':scope > p');
  if (pElements.length === 0) {
    // No <p> children — render text content directly
    return <>{contentEl.textContent}</>;
  }
  if (pElements.length === 1) {
    // Single <p> — render inline (flows after the <num>)
    return <span dangerouslySetInnerHTML={{ __html: pElements[0].innerHTML }} />;
  }
  // Multiple <p> — first one inline, rest as separate paragraphs
  return (
    <>
      <span dangerouslySetInnerHTML={{ __html: pElements[0].innerHTML }} />
      {Array.from(pElements).slice(1).map((p, i) => (
        <p key={i} className="rule-block" dangerouslySetInnerHTML={{ __html: p.innerHTML }} />
      ))}
    </>
  );
}

export { AknElementRenderer };
