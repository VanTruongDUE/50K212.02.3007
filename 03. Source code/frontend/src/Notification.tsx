import { useEffect, useRef, useState, type ReactNode } from 'react';
import './notification.css';

export default function Notification({ children, className, onClose }: {
  children: ReactNode;
  className: string;
  onClose?: () => void;
}) {
  const [visible, setVisible] = useState(true);
  const onCloseRef = useRef(onClose);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(false);
      onCloseRef.current?.();
    }, 5000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;
  return <div className={`${className} dismissible-notification`} role="status">
    {children}
    <button className="notification-close" type="button" aria-label="Đóng thông báo" onClick={() => {
      setVisible(false);
      onClose?.();
    }}>×</button>
  </div>;
}
