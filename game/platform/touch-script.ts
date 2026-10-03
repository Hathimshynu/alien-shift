/**
 * Runs inline in <head> (app/layout.tsx) before the page is drawn, so the touch UI never flashes the desktop
 * layout first. Same rule as described in viewport.ts.
 */
export const DETECT_TOUCH_SCRIPT = `(function(){try{var d=document.documentElement,q=location.search,m=function(s){return window.matchMedia&&matchMedia(s).matches};var t=/[?&]touch=1/.test(q)?true:/[?&]touch=0/.test(q)?false:(m("(pointer: coarse)")||((navigator.maxTouchPoints>0||m("(any-pointer: coarse)"))&&Math.min(screen.width,screen.height)<=600));if(t)d.setAttribute("data-touch","");}catch(e){}})();`;

