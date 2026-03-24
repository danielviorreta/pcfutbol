export function NewsList({ news }: { news: string[] }) {
  return (
    <ul className="news-list">
      {news.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  )
}
