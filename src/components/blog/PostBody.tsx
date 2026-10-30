import type { ContentBlock } from "@/lib/blog";

export function PostBody({ body }: { body: ContentBlock[] }) {
  return (
    <div className="prose-quantra">
      {body.map((block, i) => {
        switch (block.type) {
          case "p":
            return <p key={i}>{block.text}</p>;
          case "h2":
            return <h2 key={i}>{block.text}</h2>;
          case "h3":
            return <h3 key={i}>{block.text}</h3>;
          case "ul":
            return (
              <ul key={i}>
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i}>
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            );
          case "quote":
            return (
              <blockquote key={i}>
                <p>{block.text}</p>
                {block.cite ? <cite>{block.cite}</cite> : null}
              </blockquote>
            );
          case "callout":
            return (
              <aside key={i} className="callout">
                {block.title ? (
                  <p className="callout-title">{block.title}</p>
                ) : null}
                <p>{block.text}</p>
              </aside>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
