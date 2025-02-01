const Tooltip = BdApi.Components?.Tooltip;

export default function SuppressedMentionComponent() {
	return (
		<Tooltip text="Mention Suppressed">
			{({onMouseEnter, onMouseLeave}) => (
				<span className="suppressedMention" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
					@
				</span>
			)}
		</Tooltip>
	);
}
