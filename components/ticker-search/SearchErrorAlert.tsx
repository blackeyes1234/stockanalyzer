import { memo } from "react";

type SearchErrorAlertProps = { message: string };

export const SearchErrorAlert = memo(function SearchErrorAlert({
  message,
}: SearchErrorAlertProps) {
  return (
    <p
      className="text-sm font-medium text-red-600 motion-safe:animate-[stock-detail-fade-in_320ms_ease-out] dark:text-red-400"
      role="alert"
    >
      {message}
    </p>
  );
});
