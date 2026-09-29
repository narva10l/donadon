/* Configuracion de Jest para las pruebas del frontend de Donando.
 *
 * El frontend es HTML + JS plano, sin framework ni modulos, asi que
 * para probarlo hacen falta tres cosas:
 *
 *   - un DOM de mentira (jsdom)
 *   - una copia de localStorage (jsdom ya la trae, y cada iframe
 *     tiene la suya)
 *   - un fetch falso, porque las pruebas no hablan con la API real
 *
 * El aislamiento por prueba se resuelve en tests-js/ayudas.js.
 */

module.exports = {
  testEnvironment: "jsdom",

  testMatch: ["<rootDir>/tests-js/**/*.test.js"],

  // Cada prueba empieza con los contadores en cero, para que una no
  // se apoye en las llamadas de la anterior.
  clearMocks: true,
};
