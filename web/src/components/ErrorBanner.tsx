import { ApiError } from '../api/client';

export function ErrorBanner({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'Something went wrong';
  const details = error instanceof ApiError ? error.details : undefined;

  return (
    <div className="error-banner" role="alert">
      <strong>{message}</strong>
      {details && details.length > 0 && (
        <ul>
          {details.map((d, i) => (
            <li key={i}>
              {d.path}: {d.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
