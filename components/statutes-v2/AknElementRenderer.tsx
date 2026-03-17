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
  const tag = element.localName.toLowerCase();

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

  // --- Section (numbered legal sections with headings) ---
  if (tag === 'section') {
    const num = element.querySelector(':scope > num');
    const heading = element.querySelector(':scope > heading');
    return (
      <div className="section-block">
        {(num || heading) && (
          <h3 className="section-heading">
            {num && <span>{num.textContent} </span>}
            {heading?.textContent}
          </h3>
        )}
        {renderChildElementsExcept(element, ['num', 'heading'])}
      </div>
    );
  }

  // --- Attachment-related containers (schedules, appendices) ---
  if (tag === 'attachments' || tag === 'attachment' || tag === 'doc' || tag === 'mainbody') {
    return <>{renderChildElements(element)}</>;
  }

  // --- Heading (inside structural elements) ---
  if (tag === 'heading') {
    const parentTag = element.parentElement?.localName?.toLowerCase();
    const isScheduleHeading = parentTag === 'schedule' || parentTag === 'attachment';
    const className = isScheduleHeading ? 'schedule-heading' : 'order-heading';
    // Check for a sibling <num> in the parent (e.g. "Part 1" before "PRELIMINARY")
    const siblingNum = element.parentElement?.querySelector(':scope > num');
    return (
      <h2 className={className}>
        {siblingNum && <span>{siblingNum.textContent} — </span>}
        {element.textContent}
      </h2>
    );
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
    if (contentEl) {
      // Simple: num + content
      return (
        <div><div className="subsection">
          {num && <span className="num">{num.textContent}</span>}
          {renderInlineContent(contentEl)}
        </div></div>
      );
    }
    // Complex: num + intro + paragraphs + wrapUp
    return (
      <div><div className="subsection">
        {num && <span className="num">{num.textContent}</span>}
        {renderChildElementsExcept(element, ['num'])}
      </div></div>
    );
  }

  // --- Paragraph / item (deeper indent) ---
  if (tag === 'paragraph' || tag === 'item') {
    const num = element.querySelector(':scope > num');
    const contentEl = element.querySelector(':scope > content');
    if (contentEl) {
      return (
        <div><div className="paragraph-item">
          {num && <span className="num">{num.textContent}</span>}
          {renderInlineContent(contentEl)}
        </div></div>
      );
    }
    return (
      <div><div className="paragraph-item">
        {num && <span className="num">{num.textContent}</span>}
        {renderChildElementsExcept(element, ['num'])}
      </div></div>
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

  // --- <table> — schedule fee tables, etc. ---
  if (tag === 'table') {
    return (
      <table className="statute-table">
        <tbody>{renderChildElements(element)}</tbody>
      </table>
    );
  }
  if (tag === 'tr') {
    return <tr>{renderChildElements(element)}</tr>;
  }
  if (tag === 'th') {
    return <th dangerouslySetInnerHTML={{ __html: element.innerHTML }} />;
  }
  if (tag === 'td') {
    return <td dangerouslySetInnerHTML={{ __html: element.innerHTML }} />;
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
 * Renders all child Element nodes except those with specified tag names.
 */
function renderChildElementsExcept(parent: Element, excludeTags: string[]) {
  const exclude = new Set(excludeTags);
  const children: React.ReactNode[] = [];
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (!exclude.has(child.localName.toLowerCase())) {
      children.push(<AknElementRenderer key={i} element={child} />);
    }
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
