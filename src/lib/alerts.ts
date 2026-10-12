"use client";

import Swal from "sweetalert2";

/** Alerte « il manque l'acceptation des conditions », dans le style de l'application. */
export function alertTermsRequired() {
  return Swal.fire({
    icon: "warning",
    title: "Conditions générales",
    html: "Merci de <b>cocher la case</b> « J'ai lu et j'accepte les conditions générales d'utilisation et de vente » pour créer votre compte.",
    confirmButtonText: "Compris",
    confirmButtonColor: "#0a5ff0",
    customClass: { popup: "rounded-3xl", confirmButton: "rounded-xl" },
  });
}
