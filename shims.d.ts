declare module 'pdfjs-dist/build/pdf.worker?worker' {
  const WorkerFactory: new () => Worker
  export default WorkerFactory
}

