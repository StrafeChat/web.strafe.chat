export const LoadingScreen = () => {
  return (
    <div
      class={`fixed inset-0 bg-[var(--background)] bg-opacity-80 flex justify-center items-center transition-opacity`}
    >
      <div class="w-16 h-16 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
};
