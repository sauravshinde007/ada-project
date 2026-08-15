import React, { useEffect, useRef, useState } from 'react';
import { AvatarController } from './AvatarController';
import { VRMAvatarProps } from './avatarTypes';
import './VRMAvatar.css';

export const VRMAvatar: React.FC<VRMAvatarProps> = ({ modelUrl }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<AvatarController | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [expressions, setExpressions] = useState<string[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    const controller = new AvatarController(containerRef.current);
    controllerRef.current = controller;

    controller.load(modelUrl, (p) => {
      setProgress(p);
    }).then((availableExpressions) => {
      setExpressions(availableExpressions);
      setLoading(false);
    }).catch((err) => {
      console.error(err);
      setError("Failed to load Ada's avatar.");
      setLoading(false);
    });

    const handleResize = () => {
       if (containerRef.current && controllerRef.current) {
          controllerRef.current.resizeTo(containerRef.current.clientWidth, containerRef.current.clientHeight);
       }
    };
    
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      controller.dispose();
      controllerRef.current = null;
    };
  }, [modelUrl]);

  const handleExpressionTest = (expr: string) => {
    if (!controllerRef.current) return;
    expressions.forEach(e => controllerRef.current?.setExpression(e, 0));
    controllerRef.current.setExpression(expr, 1.0);
    setTimeout(() => {
      controllerRef.current?.setExpression(expr, 0);
    }, 2000);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !controllerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    controllerRef.current.lookAt(x, y);
  };

  const handleMouseLeave = () => {
    if (!controllerRef.current) return;
    controllerRef.current.lookAt(0, 0);
  };

  return (
    <div 
      className="vrm-avatar-wrapper" 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {loading && (
        <div className="vrm-loading">
          Loading Avatar... {Math.round(progress * 100)}%
        </div>
      )}
      {error && (
        <div className="vrm-error">
          {error}
        </div>
      )}
      
      {!loading && !error && expressions.length > 0 && (
         <div className="vrm-dev-panel">
            <h4>Dev: Test Expressions</h4>
            <div className="vrm-dev-buttons">
              {expressions.map(expr => (
                 <button key={expr} onClick={() => handleExpressionTest(expr)}>
                   {expr}
                 </button>
              ))}
            </div>
         </div>
      )}
    </div>
  );
};
