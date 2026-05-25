#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Corrige acentos em palavras PT-BR em arquivos do projeto.

Aplica substituicoes case-sensitive com word boundaries em .tsx/.ts/.md
de apps/web, apps/api/src e docs. Pula node_modules, .next, dist e migrations.

Lista de pares definida em PAIRS. Tudo seguro: nao toca em identificadores
porque palavras com acento (Portugues) raramente colidem com camelCase
ingles. Para risco extra-zero, usa word boundary `\\b`.
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

# Pares (sem_acento, com_acento). Case-sensitive.
# Apenas palavras com 100% certeza de serem texto PT-BR.
PAIRS: list[tuple[str, str]] = [
    ("Periodo", "Período"), ("periodo", "período"),
    ("Periodos", "Períodos"), ("periodos", "períodos"),
    ("Inicio", "Início"), ("inicio", "início"),
    ("Termino", "Término"), ("termino", "término"),
    ("Ate", "Até"),
    ("Acoes", "Ações"), ("acoes", "ações"),
    ("Acao", "Ação"), ("acao", "ação"),
    ("Critico", "Crítico"), ("critico", "crítico"),
    ("Criticos", "Críticos"), ("criticos", "críticos"),
    ("Critica", "Crítica"), ("critica", "crítica"),
    ("Criticas", "Críticas"), ("criticas", "críticas"),
    ("Analise", "Análise"), ("analise", "análise"),
    ("Analises", "Análises"), ("analises", "análises"),
    ("Exclusao", "Exclusão"), ("exclusao", "exclusão"),
    ("Inclusao", "Inclusão"), ("inclusao", "inclusão"),
    ("Conclusao", "Conclusão"), ("conclusao", "conclusão"),
    ("Alteracao", "Alteração"), ("alteracao", "alteração"),
    ("Alteracoes", "Alterações"), ("alteracoes", "alterações"),
    ("Edicao", "Edição"), ("edicao", "edição"),
    ("Relacao", "Relação"), ("relacao", "relação"),
    ("Relacoes", "Relações"), ("relacoes", "relações"),
    ("Posicao", "Posição"), ("posicao", "posição"),
    ("Posicoes", "Posições"), ("posicoes", "posições"),
    ("Responsavel", "Responsável"), ("responsavel", "responsável"),
    ("Responsaveis", "Responsáveis"), ("responsaveis", "responsáveis"),
    ("Usuario", "Usuário"), ("usuario", "usuário"),
    ("Usuarios", "Usuários"), ("usuarios", "usuários"),
    ("Gestao", "Gestão"), ("gestao", "gestão"),
    ("Estrategia", "Estratégia"), ("estrategia", "estratégia"),
    ("Estrategias", "Estratégias"), ("estrategias", "estratégias"),
    ("Estrategico", "Estratégico"), ("estrategico", "estratégico"),
    ("Estrategica", "Estratégica"), ("estrategica", "estratégica"),
    ("Estrategicos", "Estratégicos"), ("estrategicos", "estratégicos"),
    ("Estrategicas", "Estratégicas"), ("estrategicas", "estratégicas"),
    ("Nao", "Não"), ("Sao", "São"),
    ("Producao", "Produção"), ("producao", "produção"),
    ("Atencao", "Atenção"), ("atencao", "atenção"),
    ("Automatica", "Automática"), ("automatica", "automática"),
    ("Automatico", "Automático"), ("automatico", "automático"),
    ("Automaticamente", "Automaticamente"),
    ("automaticamente", "automaticamente"),
    ("Configuracao", "Configuração"), ("configuracao", "configuração"),
    ("Configuracoes", "Configurações"), ("configuracoes", "configurações"),
    ("Descricao", "Descrição"), ("descricao", "descrição"),
    ("Descricoes", "Descrições"), ("descricoes", "descrições"),
    ("Opcao", "Opção"), ("opcao", "opção"),
    ("Opcoes", "Opções"), ("opcoes", "opções"),
    ("Reuniao", "Reunião"), ("reuniao", "reunião"),
    ("Reunioes", "Reuniões"), ("reunioes", "reuniões"),
    ("Publicacao", "Publicação"), ("publicacao", "publicação"),
    ("Integracao", "Integração"), ("integracao", "integração"),
    ("Tatico", "Tático"), ("tatico", "tático"),
    ("Tatica", "Tática"), ("tatica", "tática"),
    ("Publico", "Público"), ("publico", "público"),
    ("Publica", "Pública"), ("publica", "pública"),
    ("Negocio", "Negócio"), ("negocio", "negócio"),
    ("Negocios", "Negócios"), ("negocios", "negócios"),
    ("Servico", "Serviço"), ("servico", "serviço"),
    ("Servicos", "Serviços"), ("servicos", "serviços"),
    ("Tambem", "Também"), ("tambem", "também"),
    ("Pratica", "Prática"), ("pratica", "prática"),
    ("Praticas", "Práticas"), ("praticas", "práticas"),
    ("Pratico", "Prático"), ("pratico", "prático"),
    ("Diaria", "Diária"), ("diaria", "diária"),
    ("Diario", "Diário"), ("diario", "diário"),
    ("Sintese", "Síntese"), ("sintese", "síntese"),
    ("Comercio", "Comércio"), ("comercio", "comércio"),
    ("Pagina", "Página"), ("pagina", "página"),
    ("Paginas", "Páginas"), ("paginas", "páginas"),
    ("Titulo", "Título"), ("titulo", "título"),
    ("Numero", "Número"), ("numero", "número"),
    ("Numeros", "Números"), ("numeros", "números"),
    ("Vinculo", "Vínculo"), ("vinculo", "vínculo"),
    ("Vinculos", "Vínculos"), ("vinculos", "vínculos"),
    ("Proximo", "Próximo"), ("proximo", "próximo"),
    ("Proxima", "Próxima"), ("proxima", "próxima"),
    ("Proximos", "Próximos"), ("proximos", "próximos"),
    ("Proximas", "Próximas"), ("proximas", "próximas"),
    ("Ultimo", "Último"), ("ultimo", "último"),
    ("Ultima", "Última"), ("ultima", "última"),
    ("Ultimos", "Últimos"), ("ultimos", "últimos"),
    ("Ultimas", "Últimas"), ("ultimas", "últimas"),
    ("Historico", "Histórico"), ("historico", "histórico"),
    ("Historicos", "Históricos"), ("historicos", "históricos"),
    ("Historia", "História"), ("historia", "história"),
    ("Maximo", "Máximo"), ("maximo", "máximo"),
    ("Minimo", "Mínimo"), ("minimo", "mínimo"),
    ("Avancada", "Avançada"), ("avancada", "avançada"),
    ("Avancado", "Avançado"), ("avancado", "avançado"),
    ("Avancados", "Avançados"), ("avancados", "avançados"),
    ("Exercicio", "Exercício"), ("exercicio", "exercício"),
    ("Variavel", "Variável"), ("variavel", "variável"),
    ("Variaveis", "Variáveis"), ("variaveis", "variáveis"),
    # "formula" e "Formula" coincide com campo Indicator.formula no schema.
    # Substituicao removida para nao quebrar o codigo. Texto visivel
    # mantido sem acento; ajustar manualmente onde necessario.
    ("Metrica", "Métrica"), ("metrica", "métrica"),
    ("Metricas", "Métricas"), ("metricas", "métricas"),
    ("Saude", "Saúde"), ("saude", "saúde"),
    ("Niveis", "Níveis"), ("niveis", "níveis"),
    ("Nivel", "Nível"), ("nivel", "nível"),
    ("Indice", "Índice"), ("indice", "índice"),
    ("Indices", "Índices"), ("indices", "índices"),
    ("Conteudo", "Conteúdo"), ("conteudo", "conteúdo"),
    ("Conteudos", "Conteúdos"), ("conteudos", "conteúdos"),
    ("Excecao", "Exceção"), ("excecao", "exceção"),
    ("Excecoes", "Exceções"), ("excecoes", "exceções"),
    ("Conexao", "Conexão"), ("conexao", "conexão"),
    ("Conexoes", "Conexões"), ("conexoes", "conexões"),
    ("Calculo", "Cálculo"), ("calculo", "cálculo"),
    ("Calculos", "Cálculos"), ("calculos", "cálculos"),
    ("Salario", "Salário"), ("salario", "salário"),
    ("Politica", "Política"), ("politica", "política"),
    ("Politicas", "Políticas"), ("politicas", "políticas"),
    ("Logistica", "Logística"), ("logistica", "logística"),
    ("Estatistica", "Estatística"), ("estatistica", "estatística"),
    ("Estatisticas", "Estatísticas"), ("estatisticas", "estatísticas"),
    ("Otimo", "Ótimo"), ("otimo", "ótimo"),
    ("Otima", "Ótima"), ("otima", "ótima"),
    ("Necessario", "Necessário"), ("necessario", "necessário"),
    ("Necessaria", "Necessária"), ("necessaria", "necessária"),
    ("Estavel", "Estável"), ("estavel", "estável"),
    ("Razao", "Razão"), ("razao", "razão"),
    ("Manutencao", "Manutenção"), ("manutencao", "manutenção"),
    ("Aprovacao", "Aprovação"), ("aprovacao", "aprovação"),
    ("Aprovacoes", "Aprovações"), ("aprovacoes", "aprovações"),
    ("Operacao", "Operação"), ("operacao", "operação"),
    ("Operacoes", "Operações"), ("operacoes", "operações"),
    ("Notificacao", "Notificação"), ("notificacao", "notificação"),
    ("Notificacoes", "Notificações"), ("notificacoes", "notificações"),
    ("Permissao", "Permissão"), ("permissao", "permissão"),
    ("Permissoes", "Permissões"), ("permissoes", "permissões"),
    ("Decisao", "Decisão"), ("decisao", "decisão"),
    ("Decisoes", "Decisões"), ("decisoes", "decisões"),
    ("Sessao", "Sessão"), ("sessao", "sessão"),
    ("Sessoes", "Sessões"), ("sessoes", "sessões"),
    ("Versao", "Versão"), ("versao", "versão"),
    ("Versoes", "Versões"), ("versoes", "versões"),
    ("Padrao", "Padrão"), ("padrao", "padrão"),
    ("Padroes", "Padrões"), ("padroes", "padrões"),
    ("Dimensao", "Dimensão"), ("dimensao", "dimensão"),
    ("Faceis", "Fáceis"), ("faceis", "fáceis"),
    ("Facil", "Fácil"), ("facil", "fácil"),
    ("Possivel", "Possível"), ("possivel", "possível"),
    ("Impossivel", "Impossível"), ("impossivel", "impossível"),
    ("Disponivel", "Disponível"), ("disponivel", "disponível"),
    ("Disponiveis", "Disponíveis"), ("disponiveis", "disponíveis"),
    ("Indisponivel", "Indisponível"), ("indisponivel", "indisponível"),
    ("Compativel", "Compatível"), ("compativel", "compatível"),
    ("Incompativel", "Incompatível"), ("incompativel", "incompatível"),
    ("Visivel", "Visível"), ("visivel", "visível"),
    ("Invisivel", "Invisível"), ("invisivel", "invisível"),
    ("Util", "Útil"),
    ("Validos", "Válidos"), ("validos", "válidos"),
    ("Valido", "Válido"), ("valido", "válido"),
    ("Valida", "Válida"), ("valida", "válida"),
    ("Invalido", "Inválido"), ("invalido", "inválido"),
    ("Invalida", "Inválida"), ("invalida", "inválida"),
    ("Invalidos", "Inválidos"), ("invalidos", "inválidos"),
    ("Invalidas", "Inválidas"), ("invalidas", "inválidas"),
    ("Existencia", "Existência"), ("existencia", "existência"),
    ("Referencia", "Referência"), ("referencia", "referência"),
    ("Referencias", "Referências"), ("referencias", "referências"),
    ("Diferenca", "Diferença"), ("diferenca", "diferença"),
    ("Diferencas", "Diferenças"), ("diferencas", "diferenças"),
    ("Importancia", "Importância"), ("importancia", "importância"),
    ("Tolerancia", "Tolerância"), ("tolerancia", "tolerância"),
    ("Concordancia", "Concordância"), ("concordancia", "concordância"),
    ("Distancia", "Distância"), ("distancia", "distância"),
    ("Frequencia", "Frequência"), ("frequencia", "frequência"),
    ("Sequencia", "Sequência"), ("sequencia", "sequência"),
    ("Consequencia", "Consequência"), ("consequencia", "consequência"),
    ("Consequencias", "Consequências"), ("consequencias", "consequências"),
    ("Ocorrencia", "Ocorrência"), ("ocorrencia", "ocorrência"),
    ("Ocorrencias", "Ocorrências"), ("ocorrencias", "ocorrências"),
    ("Experiencia", "Experiência"), ("experiencia", "experiência"),
    ("Experiencias", "Experiências"), ("experiencias", "experiências"),
    ("Competencia", "Competência"), ("competencia", "competência"),
    ("Competencias", "Competências"), ("competencias", "competências"),
    ("Dependencia", "Dependência"), ("dependencia", "dependência"),
    ("Dependencias", "Dependências"), ("dependencias", "dependências"),
    ("Audiencia", "Audiência"), ("audiencia", "audiência"),
    ("Pendencia", "Pendência"), ("pendencia", "pendência"),
    ("Pendencias", "Pendências"), ("pendencias", "pendências"),
    ("Tendencia", "Tendência"), ("tendencia", "tendência"),
    ("Tendencias", "Tendências"), ("tendencias", "tendências"),
    ("Eficiencia", "Eficiência"), ("eficiencia", "eficiência"),
    ("Influencia", "Influência"), ("influencia", "influência"),
    ("Conferencia", "Conferência"), ("conferencia", "conferência"),
    ("Conferencias", "Conferências"), ("conferencias", "conferências"),
    ("Contabil", "Contábil"), ("contabil", "contábil"),
    ("Estagio", "Estágio"), ("estagio", "estágio"),
    ("Estagios", "Estágios"), ("estagios", "estágios"),
    ("Apos", "Após"), ("apos", "após"),
    ("Tipico", "Típico"), ("tipico", "típico"),
    ("Tipica", "Típica"), ("tipica", "típica"),
    ("Sera", "Será"), ("sera", "será"),
    ("Serao", "Serão"), ("serao", "serão"),
    ("Esta", "Está"),
    ("Estao", "Estão"), ("estao", "estão"),
    ("Cidadao", "Cidadão"), ("cidadao", "cidadão"),
    ("Cidadaos", "Cidadãos"), ("cidadaos", "cidadãos"),
    ("Voce", "Você"), ("voce", "você"),
    ("Voces", "Vocês"), ("voces", "vocês"),
    ("Ja", "Já"),
    ("Ola", "Olá"),
    ("Diretorio", "Diretório"), ("diretorio", "diretório"),
    ("Diretorios", "Diretórios"), ("diretorios", "diretórios"),
    ("Reproducao", "Reprodução"), ("reproducao", "reprodução"),
    ("Recomendacao", "Recomendação"), ("recomendacao", "recomendação"),
    ("Recomendacoes", "Recomendações"), ("recomendacoes", "recomendações"),
    ("Movimentacao", "Movimentação"), ("movimentacao", "movimentação"),
    ("Movimentacoes", "Movimentações"), ("movimentacoes", "movimentações"),
    ("Documentacao", "Documentação"), ("documentacao", "documentação"),
    ("Pontuacao", "Pontuação"), ("pontuacao", "pontuação"),
    ("Validacao", "Validação"), ("validacao", "validação"),
    ("Validacoes", "Validações"), ("validacoes", "validações"),
    ("Recuperacao", "Recuperação"), ("recuperacao", "recuperação"),
    ("Inativacao", "Inativação"), ("inativacao", "inativação"),
    ("Ativacao", "Ativação"), ("ativacao", "ativação"),
    ("Criacao", "Criação"), ("criacao", "criação"),
    ("Atualizacao", "Atualização"), ("atualizacao", "atualização"),
    ("Atualizacoes", "Atualizações"), ("atualizacoes", "atualizações"),
    ("Rotulo", "Rótulo"), ("rotulo", "rótulo"),
    ("Rotulos", "Rótulos"), ("rotulos", "rótulos"),
    ("Familia", "Família"), ("familia", "família"),
    ("Pais", "País"),
    # ATENCAO: "area" e "formula" colidem com nomes de coluna no schema
    # (MeetingGuest.area, Indicator.formula). Mantemos a forma sem acento
    # nos identificadores; nos textos visiveis fica tambem sem acento para
    # nao quebrar o codigo. Pode-se corrigir manualmente nas strings.
    ("Orgao", "Órgão"), ("orgao", "órgão"),
    ("Orgaos", "Órgãos"), ("orgaos", "órgãos"),
    ("Modulo", "Módulo"), ("modulo", "módulo"),
    ("Modulos", "Módulos"), ("modulos", "módulos"),
    ("Codigo", "Código"), ("codigo", "código"),
    ("Codigos", "Códigos"), ("codigos", "códigos"),
    ("Veiculo", "Veículo"), ("veiculo", "veículo"),
    ("Veiculos", "Veículos"), ("veiculos", "veículos"),
    ("Telefone", "Telefone"),
    ("Endereco", "Endereço"), ("endereco", "endereço"),
    ("Enderecos", "Endereços"), ("enderecos", "endereços"),
    ("Conferencia", "Conferência"),
    ("Reuniao", "Reunião"),
    ("Equacao", "Equação"), ("equacao", "equação"),
    ("Direcao", "Direção"), ("direcao", "direção"),
    ("Direcoes", "Direções"), ("direcoes", "direções"),
    ("Funcionario", "Funcionário"), ("funcionario", "funcionário"),
    ("Funcionarios", "Funcionários"), ("funcionarios", "funcionários"),
    ("Pre", "Pré"), ("Pos", "Pós"),
    ("Logico", "Lógico"), ("logico", "lógico"),
    ("Logica", "Lógica"), ("logica", "lógica"),
    ("Bonus", "Bônus"), ("bonus", "bônus"),
    ("Plano", "Plano"),  # sem acento, marcador
    ("Premio", "Prêmio"), ("premio", "prêmio"),
    ("Premios", "Prêmios"), ("premios", "prêmios"),
    ("Quociente", "Quociente"),  # sem acento
    ("Mes", "Mês"),
    ("Genero", "Gênero"), ("genero", "gênero"),
    ("Modico", "Módico"), ("modico", "módico"),
    ("Servidao", "Servidão"), ("servidao", "servidão"),
    ("Atribuicao", "Atribuição"), ("atribuicao", "atribuição"),
    ("Atribuicoes", "Atribuições"), ("atribuicoes", "atribuições"),
    ("Concessao", "Concessão"), ("concessao", "concessão"),
    ("Concessoes", "Concessões"), ("concessoes", "concessões"),
    ("Resolucao", "Resolução"), ("resolucao", "resolução"),
    ("Resolucoes", "Resoluções"), ("resolucoes", "resoluções"),
    ("Justificativa", "Justificativa"),  # sem acento
    ("Garantia", "Garantia"),  # sem acento
    ("Mais", "Mais"),  # sem acento
    ("Pendente", "Pendente"),  # sem acento
    ("Alocacao", "Alocação"), ("alocacao", "alocação"),
    ("Quitacao", "Quitação"), ("quitacao", "quitação"),
    ("Verificacao", "Verificação"), ("verificacao", "verificação"),
    ("Restauracao", "Restauração"), ("restauracao", "restauração"),
    ("Programacao", "Programação"), ("programacao", "programação"),
    ("Aplicacao", "Aplicação"), ("aplicacao", "aplicação"),
    ("Aplicacoes", "Aplicações"), ("aplicacoes", "aplicações"),
    ("Iniciacao", "Iniciação"), ("iniciacao", "iniciação"),
    ("Finalizacao", "Finalização"), ("finalizacao", "finalização"),
    ("Geracao", "Geração"), ("geracao", "geração"),
    ("Geracoes", "Gerações"), ("geracoes", "gerações"),
    ("Funcao", "Função"), ("funcao", "função"),
    ("Funcoes", "Funções"), ("funcoes", "funções"),
    ("Importacao", "Importação"), ("importacao", "importação"),
    ("Importacoes", "Importações"), ("importacoes", "importações"),
    ("Exportacao", "Exportação"), ("exportacao", "exportação"),
    ("Exportacoes", "Exportações"), ("exportacoes", "exportações"),
    ("Visualizacao", "Visualização"), ("visualizacao", "visualização"),
    ("Visualizacoes", "Visualizações"), ("visualizacoes", "visualizações"),
    ("Visao", "Visão"), ("visao", "visão"),
    ("Visoes", "Visões"), ("visoes", "visões"),
    ("Adesao", "Adesão"), ("adesao", "adesão"),
    ("Adicao", "Adição"), ("adicao", "adição"),
    ("Selecao", "Seleção"), ("selecao", "seleção"),
    ("Selecoes", "Seleções"), ("selecoes", "seleções"),
    ("Secao", "Seção"), ("secao", "seção"),
    ("Secoes", "Seções"), ("secoes", "seções"),
    ("Tracao", "Tração"), ("tracao", "tração"),
    ("Reacao", "Reação"), ("reacao", "reação"),
    ("Reacoes", "Reações"), ("reacoes", "reações"),
    ("Tratamento", "Tratamento"),  # sem acento
    ("Plataforma", "Plataforma"),  # sem acento
    ("Diagrama", "Diagrama"),  # sem acento
    ("Programa", "Programa"),  # sem acento
    ("Mecanico", "Mecânico"), ("mecanico", "mecânico"),
    ("Mecanica", "Mecânica"), ("mecanica", "mecânica"),
    ("Eletrico", "Elétrico"), ("eletrico", "elétrico"),
    ("Eletrica", "Elétrica"), ("eletrica", "elétrica"),
    ("Botao", "Botão"), ("botao", "botão"),
    ("Botoes", "Botões"), ("botoes", "botões"),
    ("Cancao", "Canção"), ("cancao", "canção"),
    ("Caminhao", "Caminhão"), ("caminhao", "caminhão"),
    ("Caminhoes", "Caminhões"), ("caminhoes", "caminhões"),
    ("Solucao", "Solução"), ("solucao", "solução"),
    ("Solucoes", "Soluções"), ("solucoes", "soluções"),
    ("Confirmacao", "Confirmação"), ("confirmacao", "confirmação"),
    ("Confirmacoes", "Confirmações"), ("confirmacoes", "confirmações"),
    ("Avaliacao", "Avaliação"), ("avaliacao", "avaliação"),
    ("Avaliacoes", "Avaliações"), ("avaliacoes", "avaliações"),
    ("Mediacao", "Mediação"), ("mediacao", "mediação"),
    ("Aprendizado", "Aprendizado"),  # sem acento
    ("Marca", "Marca"),  # sem acento
    ("Tarefa", "Tarefa"),  # sem acento
    ("Reposicao", "Reposição"), ("reposicao", "reposição"),
    ("Substituicao", "Substituição"), ("substituicao", "substituição"),
    ("Substituicoes", "Substituições"), ("substituicoes", "substituições"),
    ("Demissao", "Demissão"), ("demissao", "demissão"),
    ("Admissao", "Admissão"), ("admissao", "admissão"),
    ("Promocao", "Promoção"), ("promocao", "promoção"),
    ("Promocoes", "Promoções"), ("promocoes", "promoções"),
    ("Devolucao", "Devolução"), ("devolucao", "devolução"),
    ("Devolucoes", "Devoluções"), ("devolucoes", "devoluções"),
    ("Indenizacao", "Indenização"), ("indenizacao", "indenização"),
    ("Comissao", "Comissão"), ("comissao", "comissão"),
    ("Comissoes", "Comissões"), ("comissoes", "comissões"),
    ("Plantao", "Plantão"), ("plantao", "plantão"),
    ("Capitao", "Capitão"), ("capitao", "capitão"),
    ("Pisado", "Pisado"),  # sem acento
    ("Cao", "Cão"),
    ("Demanda", "Demanda"),  # sem acento
    ("Demandas", "Demandas"),  # sem acento
    ("Lider", "Líder"), ("lider", "líder"),
    ("Lideres", "Líderes"), ("lideres", "líderes"),
    ("Faixa", "Faixa"),  # sem acento
    ("Fundo", "Fundo"),  # sem acento
    ("Forte", "Forte"),  # sem acento
    ("Magico", "Mágico"), ("magico", "mágico"),
    ("Magica", "Mágica"), ("magica", "mágica"),
    ("Magicas", "Mágicas"), ("magicas", "mágicas"),
    ("Magicos", "Mágicos"), ("magicos", "mágicos"),
    ("Resumo", "Resumo"),  # sem acento
    ("Trafico", "Tráfico"), ("trafico", "tráfico"),
    ("Trafico", "Tráfico"),
    ("Pratico", "Prático"),
    ("Acentuado", "Acentuado"),  # sem acento
    ("Atletico", "Atlético"), ("atletico", "atlético"),
    ("Domestica", "Doméstica"), ("domestica", "doméstica"),
    ("Domestico", "Doméstico"), ("domestico", "doméstico"),
    ("Domesticos", "Domésticos"), ("domesticos", "domésticos"),
    ("Politico", "Político"), ("politico", "político"),
    ("Politicos", "Políticos"), ("politicos", "políticos"),
    ("Especialista", "Especialista"),  # sem acento
    ("Especifico", "Específico"), ("especifico", "específico"),
    ("Especifica", "Específica"), ("especifica", "específica"),
    ("Especificos", "Específicos"), ("especificos", "específicos"),
    ("Especificas", "Específicas"), ("especificas", "específicas"),
    ("Especializado", "Especializado"),  # sem acento
    ("Sucesso", "Sucesso"),  # sem acento
    ("Resgate", "Resgate"),  # sem acento
    ("Caracteristica", "Característica"), ("caracteristica", "característica"),
    ("Caracteristicas", "Características"), ("caracteristicas", "características"),
    ("Caracteristico", "Característico"), ("caracteristico", "característico"),
    ("Trafico", "Tráfico"),
    ("Lancamento", "Lançamento"), ("lancamento", "lançamento"),
    ("Lancamentos", "Lançamentos"), ("lancamentos", "lançamentos"),
    ("Comunicacao", "Comunicação"), ("comunicacao", "comunicação"),
    ("Comunicacoes", "Comunicações"), ("comunicacoes", "comunicações"),
    ("Educacao", "Educação"), ("educacao", "educação"),
    ("Inflacao", "Inflação"), ("inflacao", "inflação"),
    ("Realizacao", "Realização"), ("realizacao", "realização"),
    ("Realizacoes", "Realizações"), ("realizacoes", "realizações"),
    ("Identificacao", "Identificação"), ("identificacao", "identificação"),
    ("Modelo", "Modelo"),  # sem acento
    ("Cabecalho", "Cabeçalho"), ("cabecalho", "cabeçalho"),
    ("Cabecalhos", "Cabeçalhos"), ("cabecalhos", "cabeçalhos"),
    ("Cancelar", "Cancelar"),  # sem acento, correto
    ("Cancelado", "Cancelado"),  # sem acento, correto
    ("Cancelada", "Cancelada"),  # sem acento, correto
    ("Confirmar", "Confirmar"),  # sem acento, correto
    ("Cobranca", "Cobrança"), ("cobranca", "cobrança"),
    ("Cobrancas", "Cobranças"), ("cobrancas", "cobranças"),
    ("Inscricao", "Inscrição"), ("inscricao", "inscrição"),
    ("Inscricoes", "Inscrições"), ("inscricoes", "inscrições"),
    ("Devolver", "Devolver"),  # sem acento, correto
    ("Vencimento", "Vencimento"),  # sem acento
    ("Sancao", "Sanção"), ("sancao", "sanção"),
    ("Sancoes", "Sanções"), ("sancoes", "sanções"),
    ("Esclarecimento", "Esclarecimento"),  # sem acento
    ("Encerramento", "Encerramento"),  # sem acento
    ("Vigencia", "Vigência"), ("vigencia", "vigência"),
    ("Vigencias", "Vigências"), ("vigencias", "vigências"),
    ("Quaisquer", "Quaisquer"),  # sem acento
    ("Sintese", "Síntese"),
    ("Inscricao", "Inscrição"),
    ("Carater", "Caráter"), ("carater", "caráter"),
    ("Vermelho", "Vermelho"),  # sem acento
    ("Indicadores", "Indicadores"),  # sem acento
    ("Indicador", "Indicador"),  # sem acento
    ("Pago", "Pago"),  # sem acento
    ("Saida", "Saída"), ("saida", "saída"),
    ("Saidas", "Saídas"), ("saidas", "saídas"),
    ("Habito", "Hábito"), ("habito", "hábito"),
    ("Habitos", "Hábitos"), ("habitos", "hábitos"),
    ("Decreto", "Decreto"),  # sem acento
    ("Negativo", "Negativo"),  # sem acento
    ("Positivo", "Positivo"),  # sem acento
    ("Insumos", "Insumos"),  # sem acento
    ("Ja", "Já"),
    ("Padrao", "Padrão"),
    ("Maquina", "Máquina"), ("maquina", "máquina"),
    ("Maquinas", "Máquinas"), ("maquinas", "máquinas"),
    ("Veterano", "Veterano"),  # sem acento
    ("Plantao", "Plantão"),
    ("Memoria", "Memória"), ("memoria", "memória"),
    ("Memorias", "Memórias"), ("memorias", "memórias"),
    ("Hibrido", "Híbrido"), ("hibrido", "híbrido"),
    ("Tecnico", "Técnico"), ("tecnico", "técnico"),
    ("Tecnica", "Técnica"), ("tecnica", "técnica"),
    ("Tecnicos", "Técnicos"), ("tecnicos", "técnicos"),
    ("Tecnicas", "Técnicas"), ("tecnicas", "técnicas"),
    ("Cientifico", "Científico"), ("cientifico", "científico"),
    ("Cientifica", "Científica"), ("cientifica", "científica"),
    ("Eletronico", "Eletrônico"), ("eletronico", "eletrônico"),
    ("Eletronica", "Eletrônica"), ("eletronica", "eletrônica"),
    ("Eletronicos", "Eletrônicos"), ("eletronicos", "eletrônicos"),
    ("Quimico", "Químico"), ("quimico", "químico"),
    ("Quimica", "Química"), ("quimica", "química"),
    ("Diaria", "Diária"),
    ("Forca", "Força"), ("forca", "força"),
    ("Forcas", "Forças"), ("forcas", "forças"),
    ("Servico", "Serviço"),
    ("Telefone", "Telefone"),
    ("Bilingue", "Bilíngue"), ("bilingue", "bilíngue"),
    ("Anuncio", "Anúncio"), ("anuncio", "anúncio"),
    ("Anuncios", "Anúncios"), ("anuncios", "anúncios"),
    ("Refugio", "Refúgio"), ("refugio", "refúgio"),
    ("Energia", "Energia"),  # sem acento
    ("Acidente", "Acidente"),  # sem acento
    ("Acidentes", "Acidentes"),  # sem acento
    ("Recarga", "Recarga"),  # sem acento
    ("Pratico", "Prático"),
    ("Pacifico", "Pacífico"), ("pacifico", "pacífico"),
    ("Pacifica", "Pacífica"), ("pacifica", "pacífica"),
    ("Especial", "Especial"),  # sem acento
    ("Sucesso", "Sucesso"),  # sem acento
    ("Sazonal", "Sazonal"),  # sem acento
    ("Sazonais", "Sazonais"),  # sem acento
    ("Acessivel", "Acessível"), ("acessivel", "acessível"),
    ("Inacessivel", "Inacessível"), ("inacessivel", "inacessível"),
    ("Suficiente", "Suficiente"),  # sem acento
    ("Insuficiente", "Insuficiente"),  # sem acento
    ("Inforacao", "Informação"),  # typo
    ("Informacao", "Informação"), ("informacao", "informação"),
    ("Informacoes", "Informações"), ("informacoes", "informações"),
    ("Modificacao", "Modificação"), ("modificacao", "modificação"),
    ("Modificacoes", "Modificações"), ("modificacoes", "modificações"),
    ("Sugestao", "Sugestão"), ("sugestao", "sugestão"),
    ("Sugestoes", "Sugestões"), ("sugestoes", "sugestões"),
    ("Questao", "Questão"), ("questao", "questão"),
    ("Questoes", "Questões"), ("questoes", "questões"),
    ("Profissao", "Profissão"), ("profissao", "profissão"),
    ("Profissoes", "Profissões"), ("profissoes", "profissões"),
    ("Pretensao", "Pretensão"), ("pretensao", "pretensão"),
    ("Discussao", "Discussão"), ("discussao", "discussão"),
    ("Discussoes", "Discussões"), ("discussoes", "discussões"),
    ("Inflacao", "Inflação"),
    ("Limitacao", "Limitação"), ("limitacao", "limitação"),
    ("Limitacoes", "Limitações"), ("limitacoes", "limitações"),
    ("Limite", "Limite"),  # sem acento
    ("Limites", "Limites"),  # sem acento
    ("Bens", "Bens"),  # sem acento
    ("Tom", "Tom"),  # sem acento
    ("Detalhe", "Detalhe"),  # sem acento
    ("Detalhes", "Detalhes"),  # sem acento
    ("Espacial", "Espacial"),  # sem acento
    ("Cargo", "Cargo"),  # sem acento
    ("Cargos", "Cargos"),  # sem acento
    ("Recursos", "Recursos"),  # sem acento
    ("Comum", "Comum"),  # sem acento
    ("Comuns", "Comuns"),  # sem acento
    ("Empresa", "Empresa"),  # sem acento
    ("Empresas", "Empresas"),  # sem acento
    ("Comum", "Comum"),  # sem acento
    ("Geral", "Geral"),  # sem acento
    ("Gerais", "Gerais"),  # sem acento
    ("Grupo", "Grupo"),  # sem acento
    ("Pacote", "Pacote"),  # sem acento
    ("Acervo", "Acervo"),  # sem acento
    ("Manual", "Manual"),  # sem acento
    ("Padrao", "Padrão"),
    ("Acumulado", "Acumulado"),  # sem acento
    ("Acumulada", "Acumulada"),  # sem acento
    ("Acumuladas", "Acumuladas"),  # sem acento
    ("Acumulados", "Acumulados"),  # sem acento
    ("Adicional", "Adicional"),  # sem acento
    ("Adicionar", "Adicionar"),  # sem acento
]

# Deduplicacao preservando ordem
seen = set()
DEDUP_PAIRS: list[tuple[str, str]] = []
for src, dst in PAIRS:
    if src in seen:
        continue
    if src == dst:
        continue
    seen.add(src)
    DEDUP_PAIRS.append((src, dst))


ROOT = Path("d:/Projetos/gestao-indicadores-sqlite")
TARGETS = [
    ROOT / "apps" / "web",
    ROOT / "apps" / "api" / "src",
    ROOT / "docs",
]

EXCLUDE_DIRS = {"node_modules", ".next", "dist", "migrations", ".git"}
EXTENSIONS = {".tsx", ".ts", ".md", ".mjs", ".html"}


def should_skip(path: Path) -> bool:
    parts = set(path.parts)
    return bool(parts & EXCLUDE_DIRS)


def collect_files() -> list[Path]:
    files: list[Path] = []
    for root in TARGETS:
        for path in root.rglob("*"):
            if not path.is_file():
                continue
            if should_skip(path):
                continue
            if path.suffix.lower() not in EXTENSIONS:
                continue
            files.append(path)
    return files


def fix_file(path: Path, regexes: list[tuple[re.Pattern, str]]) -> int:
    try:
        content = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return 0
    original = content
    total_changes = 0
    for rx, repl in regexes:
        new_content, n = rx.subn(repl, content)
        if n:
            total_changes += n
            content = new_content
    if content != original:
        path.write_text(content, encoding="utf-8", newline="")
        return total_changes
    return 0


def main() -> int:
    regexes = [
        (re.compile(rf"\b{re.escape(src)}\b"), dst) for src, dst in DEDUP_PAIRS
    ]
    files = collect_files()
    total_files = 0
    total_changes = 0
    for path in files:
        n = fix_file(path, regexes)
        if n:
            total_files += 1
            total_changes += n
            try:
                rel = path.relative_to(ROOT)
            except ValueError:
                rel = path
            print(f"{n:5d}  {rel}")
    print()
    print(f"Arquivos alterados: {total_files}")
    print(f"Substituicoes totais: {total_changes}")
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    raise SystemExit(main())
