/** Decorative reference waveform, not microphone amplitude data. */
const BAR_HEIGHTS = [
  7, 12, 18, 11, 24, 36, 19, 12, 29, 42, 25, 50, 30, 22, 40, 32,
  18, 29, 44, 34, 22, 14, 31, 42, 30, 48, 28, 22, 38, 15, 23, 16,
  12, 21, 10, 14, 8,
] as const;

type WaveformProps = {
  playing: boolean;
};

export default function Waveform({ playing }: WaveformProps) {
  return (
    <div
      aria-hidden="true"
      className={`flex h-[82px] w-full items-center justify-center gap-[3px] transition-opacity duration-300 ${
        playing ? "opacity-100" : "opacity-40"
      }`}
    >
      {BAR_HEIGHTS.map((height, index) => (
        <span
          key={index}
          className={`w-[3px] min-w-0 flex-1 rounded-full ${
            index > 25
              ? "bg-[#ff667a]"
              : index > 15
                ? "bg-[#bc97f9]"
                : "bg-[#7296ff]"
          }`}
          style={{ height }}
        />
      ))}
    </div>
  );
}
