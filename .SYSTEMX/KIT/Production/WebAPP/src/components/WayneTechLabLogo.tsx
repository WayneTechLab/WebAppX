import type { ImgHTMLAttributes } from "react";
import "../styles/wayne-tech-lab-brand.css";
type Variant="logo"|"wayne"|"tech-lab"|"all-text";
type Props=Omit<ImgHTMLAttributes<HTMLImageElement>,"src"|"alt">&{variant?:Variant;alt?:string};
export function WayneTechLabLogo({variant="tech-lab",alt="Wayne Tech Lab",className="",...props}:Props){return <img src={`/brand/wtl-${variant}.svg`} alt={alt} className={`wtl-logo ${className}`.trim()} {...props}/>;}
