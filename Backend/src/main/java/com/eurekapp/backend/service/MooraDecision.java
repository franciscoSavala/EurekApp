package com.eurekapp.backend.service;

import java.util.Arrays;

public class MooraDecision {
    // Matriz de decisiones: cada fila es una alternativa y cada columna es un criterio
    private double[][] matrizDecisiones;
    // Pesos para cada criterio
    private double[] pesos;
    // Identificar cuáles son criterios beneficiosos (true) o no beneficiosos (false)
    private boolean[] criteriosBeneficiosos;

    // Constructor para inicializar la matriz de decisiones, los pesos y los criterios
    public MooraDecision(double[][] matrizDecisiones, double[] pesos, boolean[] criteriosBeneficiosos) {
        this.matrizDecisiones = matrizDecisiones;
        this.pesos = pesos;
        this.criteriosBeneficiosos = criteriosBeneficiosos;
    }

    // Método para normalizar la matriz de decisiones
    private double[][] normalizarMatriz() {
        double[][] matrizNormalizada = new double[matrizDecisiones.length][matrizDecisiones[0].length];

        // Normalizar cada columna
        for (int j = 0; j < matrizDecisiones[0].length; j++) {
            double sumaCuadrados = 0.0;

            // Calcular la suma de los cuadrados de la columna j
            for (int i = 0; i < matrizDecisiones.length; i++) {
                sumaCuadrados += Math.pow(matrizDecisiones[i][j], 2);
            }

            double raizCuadrada = Math.sqrt(sumaCuadrados);

            // Normalizar cada valor dividiendo por la raíz de la suma de cuadrados
            for (int i = 0; i < matrizDecisiones.length; i++) {
                matrizNormalizada[i][j] = matrizDecisiones[i][j] / raizCuadrada;
            }
        }
        return matrizNormalizada;
    }

    // Método para aplicar los pesos a la matriz normalizada
    private double[][] aplicarPesos(double[][] matrizNormalizada) {
        double[][] matrizPonderada = new double[matrizNormalizada.length][matrizNormalizada[0].length];

        for (int i = 0; i < matrizNormalizada.length; i++) {
            for (int j = 0; j < matrizNormalizada[0].length; j++) {
                matrizPonderada[i][j] = matrizNormalizada[i][j] * pesos[j];
            }
        }
        return matrizPonderada;
    }

    // Método para calcular la puntuación final de cada alternativa usando MOORA
    public double[] calcularPuntuaciones() {
        double[][] matrizNormalizada = normalizarMatriz();
        double[][] matrizPonderada = aplicarPesos(matrizNormalizada);
        double[] puntuaciones = new double[matrizPonderada.length];

        // Para cada alternativa, sumar criterios beneficiosos y restar los no beneficiosos
        for (int i = 0; i < matrizPonderada.length; i++) {
            double sumaBeneficiosos = 0.0;
            double sumaNoBeneficiosos = 0.0;

            for (int j = 0; j < matrizPonderada[0].length; j++) {
                if (criteriosBeneficiosos[j]) {
                    sumaBeneficiosos += matrizPonderada[i][j];
                } else {
                    sumaNoBeneficiosos += matrizPonderada[i][j];
                }
            }

            // Puntuación final: sumar beneficiosos y restar no beneficiosos
            puntuaciones[i] = sumaBeneficiosos - sumaNoBeneficiosos;
        }
        return puntuaciones;
    }

    // Método para obtener la mejor alternativa (la que tenga la mayor puntuación)
    public int obtenerMejorDecision() {
        double[] puntuaciones = calcularPuntuaciones();
        double mejorPuntuacion = Double.NEGATIVE_INFINITY;
        int indiceMejor = -1;

        for (int i = 0; i < puntuaciones.length; i++) {
            if (puntuaciones[i] > mejorPuntuacion) {
                mejorPuntuacion = puntuaciones[i];
                indiceMejor = i;
            }
        }
        return indiceMejor; // El índice de la mejor alternativa
    }

    // Método para imprimir la matriz
    public void imprimirMatriz(double[][] matriz) {
        for (double[] fila : matriz) {
            System.out.println(Arrays.toString(fila));
        }
    }
}
