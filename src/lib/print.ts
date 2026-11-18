export function exportPrint(): void {
  const root = document.documentElement;
  root.classList.add("printing");
  window.addEventListener(
    "afterprint",
    () => root.classList.remove("printing"),
    { once: true },
  );
  window.print();
}