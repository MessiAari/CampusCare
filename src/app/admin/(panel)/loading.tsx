export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="skeleton h-8 w-40" />
      <div className="skeleton h-10 w-full max-w-xl" />
      <div className="skeleton h-96" />
    </div>
  );
}
