// Solo se llama con el resultado validado de recibirArchivo y un contexto vigente.
// La URL conserva una ventana de consumo incluso si React se desmonta después
// del click. El temporizador es dueño de su liberación, no el componente.
export const activarDescarga = ({ blob, nombre }) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  try {
    anchor.href = url;
    anchor.download = nombre;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
};
