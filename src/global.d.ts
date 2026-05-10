// Força o TypeScript a reconhecer importações de arquivos CSS
declare module "*.css" {
  const content: { [className: string]: string };
  export default content;
}