import nodemailer, { type Transporter } from "nodemailer";

/**
 * Módulo de e-mail (ADR-0014). Desenvolvimento: SMTP do Mailpit (nada sai da
 * máquina). Demonstração e produção trocam apenas o transporte.
 * Regra: nunca registrar em log o conteúdo nem o destinatário (ADR-0007).
 */
export type Email = { para: string; assunto: string; texto: string; html?: string };

let transporte: Transporter | undefined;

function obterTransporte(): Transporter {
  transporte ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "localhost",
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: false,
  });
  return transporte;
}

export async function enviarEmail(email: Email): Promise<void> {
  await obterTransporte().sendMail({
    from: process.env.EMAIL_REMETENTE ?? "nao-responda@localhost",
    to: email.para,
    subject: email.assunto,
    text: email.texto,
    html: email.html,
  });
}
