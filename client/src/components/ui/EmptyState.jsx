export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="card p-10 text-center">
      {Icon && <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-navy-800 text-slate-400"><Icon size={28} /></div>}
      <h3 className="text-lg font-semibold text-navy-800 dark:text-white">{title}</h3>
      {description && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
