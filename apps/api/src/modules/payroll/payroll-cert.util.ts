/**
 * Utilitários de certificado digital A1 para o eSocial: parse do PKCS#12 (.pfx)
 * e assinatura XML-DSig enveloped (C14N exclusiva, SHA-256, RSA-SHA256) exigida
 * pelo eSocial.
 *
 * ⚠️ A chave privada só existe em memória durante a assinatura; o PFX/senha são
 * guardados CIFRADOS (AES-256-GCM) e decifrados apenas aqui, no momento do uso.
 * A validação final do XML assinado deve ser feita no validador oficial antes
 * de qualquer transmissão em produção.
 */
import * as forge from 'node-forge';
import { SignedXml } from 'xml-crypto';

export const SHA256 = 'http://www.w3.org/2001/04/xmlenc#sha256';
export const RSA_SHA256 = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
export const EXC_C14N = 'http://www.w3.org/2001/10/xml-exc-c14n#';
export const ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';

export interface ParsedCertificate {
  privateKeyPem: string;
  certPem: string;
  subjectName: string | null;
  serialNumber: string | null;
  validFrom: Date | null;
  validUntil: Date | null;
}

/** Extrai chave privada, certificado e metadados de um .pfx (base64) + senha. */
export function parsePkcs12(pfxBase64: string, password: string): ParsedCertificate {
  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    const der = forge.util.decode64(pfxBase64);
    const asn1 = forge.asn1.fromDer(der);
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);
  } catch {
    throw new Error('PFX inválido ou senha incorreta.');
  }

  const keyBag =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0] ??
    p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag]?.[0];
  const certBag = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag]?.[0];
  if (!keyBag?.key || !certBag?.cert) throw new Error('PFX sem chave privada ou certificado utilizável.');

  const cert = certBag.cert;
  return {
    privateKeyPem: forge.pki.privateKeyToPem(keyBag.key),
    certPem: forge.pki.certificateToPem(cert),
    subjectName: cert.subject.getField('CN')?.value ?? null,
    serialNumber: cert.serialNumber ?? null,
    validFrom: cert.validity?.notBefore ?? null,
    validUntil: cert.validity?.notAfter ?? null,
  };
}

/** Certificado PEM → base64 do DER (conteúdo do <X509Certificate>). */
function certPemToBase64(certPem: string): string {
  return certPem
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s+/g, '');
}

/**
 * Assina um XML de evento eSocial (`<eSocial><evtXxx Id="ID...">...`) com
 * assinatura enveloped referenciando o Id do evento. O `<Signature>` é anexado
 * como último filho do elemento raiz `<eSocial>`, no padrão exigido pelo eSocial.
 */
export function signEsocialXml(xml: string, privateKeyPem: string, certPem: string): string {
  const sig = new SignedXml({
    privateKey: privateKeyPem,
    publicCert: certPem,
    signatureAlgorithm: RSA_SHA256,
    canonicalizationAlgorithm: EXC_C14N,
  });

  // Referência ao elemento do evento (filho de <eSocial>) pelo atributo Id.
  sig.addReference({
    xpath: "/*[local-name(.)='eSocial']/*[@Id]",
    transforms: [ENVELOPED, EXC_C14N],
    digestAlgorithm: SHA256,
  });

  // KeyInfo com o X509Certificate (exigido pelo eSocial).
  sig.getKeyInfoContent = () => `<X509Data><X509Certificate>${certPemToBase64(certPem)}</X509Certificate></X509Data>`;

  sig.computeSignature(xml, {
    location: { reference: "/*[local-name(.)='eSocial']", action: 'append' },
  });
  return sig.getSignedXml();
}
