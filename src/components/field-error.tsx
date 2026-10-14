export function FieldError({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p id={id} className="text-destructive text-sm">
      {errors[0]}
    </p>
  );
}
