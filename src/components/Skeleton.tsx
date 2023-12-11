export default function Skeleton({ className, children }: { className: string, children?: JSX.Element }) {
    return (
        <div className={`skeleton ${className}`}>
            {children}
        </div>
    )
}