export function TagList({ tags }: { tags: readonly string[] }) {
  return <div className="tag-list">
    {tags.slice(0, 3).map(tag => <span className="badge" key={tag}>{tag}</span>)}
    {tags.length > 3 && <span className="badge" aria-label={`${tags.length - 3} categorias adicionais`} title={tags.slice(3).join(", ")}>+{tags.length - 3}</span>}
  </div>;
}
