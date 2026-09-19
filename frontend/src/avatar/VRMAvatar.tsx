import React, { useEffect, useRef, useState } from 'react';
import { AvatarController } from './AvatarController';
import { VRMAvatarProps } from './avatarTypes';
import './VRMAvatar.css';

export const VRMAvatar: React.FC<VRMAvatarProps> = ({ modelUrl, emotion, intensity, animation, isTalking, isThinking }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<AvatarController | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [expressions, setExpressions] = useState<string[]>([]);
  const [isDevPanelOpen, setIsDevPanelOpen] = useState(false);

  const emotionToExpressionMap: Record<string, string> = {
    neutral: 'neutral',
    happy: 'happy',
    sad: 'sad',
    angry: 'angry',
    excited: 'happy',
    surprised: 'surprised',
    curious: 'relaxed',
    confused: 'neutral',
    embarrassed: 'sad',
    annoyed: 'angry'
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const controller = new AvatarController(containerRef.current);
    controllerRef.current = controller;

    controller.load(modelUrl, (p) => {
      setProgress(p);
    }).then(async (availableExpressions) => {
      setExpressions(availableExpressions);
      
      try {
         const animsToLoad = [
           { file: 'Standing_Idle.fbx', name: 'idle' },
           { file: 'Thinking.fbx', name: 'Thinking' },
           { file: 'Angry.fbx', name: 'Angry' },
           { file: 'Explaining.fbx', name: 'Explaining' },
           { file: 'Talking.fbx', name: 'Talking' },
           { file: 'Bashful.fbx', name: 'Bashful' },
           { file: 'Happy.fbx', name: 'Happy' },
           { file: 'Rejected.fbx', name: 'Rejected' },
           { file: 'Thankful.fbx', name: 'Thankful' }
         ];
         
         const loadPromises = animsToLoad.map(a => 
           controller.loadAnimation(`/ada_default_anim/${a.file}`, a.name)
             .catch(err => console.warn(`Failed to load ${a.file}`, err))
         );
         
         await Promise.all(loadPromises);
         controller.playAnimation('idle');
      } catch (err) {
         console.warn("Failed to load animations", err);
      }
      
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

  useEffect(() => {
    if (!controllerRef.current) return;

    if (isTalking) {
      if (emotion && intensity !== undefined) {
        expressions.forEach(e => {
          if (e !== 'blink') {
            controllerRef.current?.setExpression(e, 0);
          }
        });
        
        const targetExpr = emotionToExpressionMap[emotion.toLowerCase()] || 'neutral';
        
        if (expressions.includes(targetExpr)) {
          controllerRef.current.setExpression(targetExpr, intensity);
        } else if (expressions.includes('neutral')) {
          controllerRef.current.setExpression('neutral', intensity);
        }
      }
    } else {
      // Return to normal IDLE baseline when not talking
      expressions.forEach(e => {
        if (e !== 'blink') {
          controllerRef.current?.setExpression(e, 0);
        }
      });
      if (expressions.includes('neutral')) {
        controllerRef.current.setExpression('neutral', 1.0);
      }
    }
  }, [emotion, intensity, expressions, isTalking]);

  useEffect(() => {
    if (!controllerRef.current) return;

    controllerRef.current.setTalking(!!isTalking);
    controllerRef.current.setThinking(!!isThinking);

    if (isThinking) {
      controllerRef.current.playAnimation('Thinking', 2.65);
    } else if (isTalking) {
      controllerRef.current.playAnimation(animation || 'Talking');
    } else {
      controllerRef.current.playAnimation('idle');
    }
  }, [isTalking, isThinking, animation]);

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
         <div className={`vrm-dev-panel ${isDevPanelOpen ? 'open' : 'closed'}`}>
            <div className="vrm-dev-toggle" onClick={() => setIsDevPanelOpen(!isDevPanelOpen)}>
               <span>{isDevPanelOpen ? '✕' : '☰'}</span>
            </div>
            <div className="vrm-dev-content">
              <div className="sidebar-section">
                <h4>Settings</h4>
                <div className="settings-placeholder">
                  Configuration settings coming soon...
                </div>
              </div>
              <div className="sidebar-section">
                <h4>Animation Scrubber</h4>
                <div style={{ padding: '0 8px' }}>
                  <label style={{ fontSize: '0.8rem', color: '#aaa', display: 'block', marginBottom: '8px' }}>
                    Find exact frame for 'Thinking'
                  </label>
                  <input 
                    type="range" 
                    min="0" 
                    max={controllerRef.current?.getAnimationDuration('Thinking') || 5} 
                    step="0.01" 
                    defaultValue="0"
                    onChange={(e) => {
                      const time = parseFloat(e.target.value);
                      controllerRef.current?.scrubAnimation('Thinking', time);
                      const display = document.getElementById('scrub-time-display');
                      if (display) display.innerText = time.toFixed(2) + 's';
                    }} 
                    style={{ width: '100%', cursor: 'pointer' }} 
                  />
                  <div style={{ fontSize: '0.75rem', color: '#fff', marginTop: '4px', textAlign: 'right' }} id="scrub-time-display">
                    0.00s
                  </div>
                </div>
              </div>
              <div className="sidebar-section">
                <h4>Test Expressions</h4>
                <div className="vrm-dev-buttons">
                  {expressions.map(expr => (
                    <button key={expr} onClick={() => handleExpressionTest(expr)}>
                      {expr}
                    </button>
                  ))}
                </div>
              </div>
            </div>
         </div>
      )}
    </div>
  );
};
