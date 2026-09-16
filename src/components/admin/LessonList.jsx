import { useMemo } from "react";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import * as Icons from "lucide-react";

export default function LessonList({ lessons, search, onEdit, onDelete, onTogglePublish }) {
  const filtered = useMemo(() => {
    if (!search) return lessons;
    return lessons.filter(l => l.title.toLowerCase().includes(search.toLowerCase()) || l.topic.toLowerCase().includes(search.toLowerCase()));
  }, [lessons, search]);

  if (filtered.length === 0) {
    return <div className="text-center p-8 text-ink-light">No lessons found.</div>;
  }

  return (
    <div className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-100 text-ink-light uppercase tracking-wider font-semibold text-xs">
            <tr>
              <th className="px-6 py-4">Title</th>
              <th className="px-6 py-4">Category</th>
              <th className="px-6 py-4">Diff. / Time</th>
              <th className="px-6 py-4">Order</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map((l) => (
              <tr key={l._id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 font-medium text-ink">
                  {l.title}
                  <div className="text-xs text-ink-faint font-normal">/{l.slug}</div>
                </td>
                <td className="px-6 py-4 text-ink-light">{l.topic}</td>
                <td className="px-6 py-4 text-ink-light whitespace-nowrap">
                  {l.difficulty} <br/> <span className="text-xs">{l.estimatedTime}</span>
                </td>
                <td className="px-6 py-4 text-ink-light whitespace-nowrap">
                  <span className="text-xs">Ord: {l.order}</span>
                </td>
                <td className="px-6 py-4">
                  <Badge tone={l.isPublished ? "success" : "warning"} size="sm">
                    {l.isPublished ? "Published" : "Draft"}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => onEdit(l)} title="Edit">
                      <Icons.Edit3 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onTogglePublish(l)} title={l.isPublished ? "Unpublish" : "Publish"}>
                      {l.isPublished ? <Icons.EyeOff className="w-4 h-4" /> : <Icons.Eye className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => onDelete(l)} title="Delete">
                      <Icons.Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
