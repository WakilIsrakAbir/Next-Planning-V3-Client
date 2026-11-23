'use client';

interface UsersToastProps {
  toastMsg: { text: string; error?: boolean };
}

export default function UsersToast({ toastMsg }: UsersToastProps) {
  return (
    <div className="toast toast-top toast-end z-50">
      <div className={`alert ${toastMsg.error ? 'alert-error' : 'alert-success'} text-white shadow-lg text-xs`}>
        <span>{toastMsg.text}</span>
      </div>
    </div>
  );
}
