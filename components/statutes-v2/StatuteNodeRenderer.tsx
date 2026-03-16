import type { StatuteTreeNode } from '@/lib/utils/statute-tree';
import type { StatuteNodeType } from '@/types/statute';

/******************************************************************************
                               Constants
******************************************************************************/

/** Root-level structural heading types */
const ROOT_HEADING_TYPES = new Set<StatuteNodeType>([
  'act', 'chapter', 'part', 'subpart', 'division', 'subdivision', 'title', 'book',
]);

/** Section-level heading types */
const SECTION_TYPES = new Set<StatuteNodeType>([
  'section', 'article', 'rule', 'regulation',
]);

/** Subsection-level types with hanging-indent number */
const SUBSECTION_TYPES = new Set<StatuteNodeType>([
  'subsection', 'clause', 'subclause', 'subrule',
]);

/** Paragraph-level types with deeper indent */
const PARAGRAPH_TYPES = new Set<StatuteNodeType>([
  'paragraph', 'item', 'subparagraph', 'point',
]);

/******************************************************************************
                               Helpers
******************************************************************************/

/**
 * Renders text that may contain HTML (e.g., <ul><li> from AKN import).
 * Replaces plain newlines with <br> for proper line breaks.
 */
function renderText(text: string) {
  // If text contains HTML tags, render as HTML
  if (/<[a-z][\s\S]*>/i.test(text)) {
    return <span dangerouslySetInnerHTML={{ __html: text }} />;
  }
  // Plain text — split on double newlines for paragraphs, single newlines for line breaks
  const paragraphs = text.split(/\n\n+/);
  if (paragraphs.length === 1) {
    return <>{text}</>;
  }
  return (
    <>
      {paragraphs.map((p, i) => (
        <span key={i}>
          {i > 0 && <><br /><br /></>}
          {p}
        </span>
      ))}
    </>
  );
}

/******************************************************************************
                               Component
******************************************************************************/

interface StatuteNodeRendererProps {
  node: StatuteTreeNode;
}

/**
 * Recursively renders a statute tree node with type-based formatting.
 * Handles intro -> children -> wrap_up flow for proper document structure.
 */
function StatuteNodeRenderer({ node }: StatuteNodeRendererProps) {
  const { node_type, node_type_label, number, title, content, intro, wrap_up, children } = node;

  // Build label (e.g., "Chapter I", "Section 33")
  const label = number ? `${node_type_label} ${number}` : node_type_label;

  // --- Root-level structural headings (Chapter, Part, Subpart, etc.) ---
  if (ROOT_HEADING_TYPES.has(node_type)) {
    return (
      <div>
        <h2 className={node_type === 'schedule' ? 'schedule-heading' : 'order-heading'}>
          {title ? `${label} — ${title}` : label}
        </h2>
        {intro && <div className="node-intro">{renderText(intro)}</div>}
        {content && <div className="node-content">{renderText(content)}</div>}
        {children.length > 0 && (
          <div className="node-children">
            {children.map((child) => (
              <StatuteNodeRenderer key={child.id} node={child} />
            ))}
          </div>
        )}
        {wrap_up && <div className="node-wrapup">{renderText(wrap_up)}</div>}
      </div>
    );
  }

  // --- Schedule ---
  if (node_type === 'schedule') {
    return (
      <div>
        <h2 className="schedule-heading">
          {title ? `${label} — ${title}` : label}
        </h2>
        {intro && <div className="node-intro">{renderText(intro)}</div>}
        {content && <div className="node-content">{renderText(content)}</div>}
        {children.length > 0 && (
          <div className="node-children">
            {children.map((child) => (
              <StatuteNodeRenderer key={child.id} node={child} />
            ))}
          </div>
        )}
        {wrap_up && <div className="node-wrapup">{renderText(wrap_up)}</div>}
      </div>
    );
  }

  // --- Crossheading (e.g., "A. SERVICE WITHIN JURISDICTION") ---
  if (node_type === 'crossheading') {
    return (
      <div className="crossheading">
        {title || content || label}
      </div>
    );
  }

  // --- Section / Rule / Article headings ---
  if (SECTION_TYPES.has(node_type)) {
    return (
      <div>
        <h3 className="section-heading">
          {title ? `${label}. ${title}` : label}
        </h3>
        {intro && <div className="node-intro">{renderText(intro)}</div>}
        {content && <div className="rule-block">{renderText(content)}</div>}
        {children.length > 0 && (
          <div className="node-children">
            {children.map((child) => (
              <StatuteNodeRenderer key={child.id} node={child} />
            ))}
          </div>
        )}
        {wrap_up && <div className="node-wrapup">{renderText(wrap_up)}</div>}
      </div>
    );
  }

  // --- Subsection with hanging indent ---
  if (SUBSECTION_TYPES.has(node_type)) {
    return (
      <div>
        <div className="subsection">
          {number && <span className="num">{number}</span>}
          {content && renderText(content)}
          {intro && renderText(intro)}
        </div>
        {children.length > 0 && (
          <div className="node-children">
            {children.map((child) => (
              <StatuteNodeRenderer key={child.id} node={child} />
            ))}
          </div>
        )}
        {wrap_up && <div className="node-wrapup">{renderText(wrap_up)}</div>}
      </div>
    );
  }

  // --- Paragraph items with deeper indent ---
  if (PARAGRAPH_TYPES.has(node_type)) {
    return (
      <div>
        <div className="paragraph-item">
          {number && <span className="num">{number}</span>}
          {content && renderText(content)}
          {intro && renderText(intro)}
        </div>
        {children.length > 0 && (
          <div className="node-children">
            {children.map((child) => (
              <StatuteNodeRenderer key={child.id} node={child} />
            ))}
          </div>
        )}
        {wrap_up && <div className="node-wrapup">{renderText(wrap_up)}</div>}
      </div>
    );
  }

  // --- Proviso ---
  if (node_type === 'proviso') {
    return (
      <div className="proviso">
        {content && renderText(content)}
        {intro && renderText(intro)}
      </div>
    );
  }

  // --- HContainer / default fallback ---
  return (
    <div>
      {title && <div className="section-heading">{title}</div>}
      {intro && <div className="node-intro">{renderText(intro)}</div>}
      {content && <div className="hcontainer-block">{renderText(content)}</div>}
      {children.length > 0 && (
        <div className="node-children">
          {children.map((child) => (
            <StatuteNodeRenderer key={child.id} node={child} />
          ))}
        </div>
      )}
      {wrap_up && <div className="node-wrapup">{renderText(wrap_up)}</div>}
    </div>
  );
}

export { StatuteNodeRenderer };
